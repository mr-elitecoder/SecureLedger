-- ============================================================
--  SecureLedger — Complete Trigger Suite
--  Database  : Oracle (PL/SQL)
--  Schema    : secureled
--  Author    : SecureLedger Team
--  Version   : 2.0  (all 8 fraud-detection rules)
-- ============================================================



-- ============================================================
-- FRAUD RULE SUMMARY
-- ============================================================
--  Rule 1  : Large transaction amount  (> 50,000)          [HIGH]
--  Rule 2  : Rapid successive transactions  (3+ / 1 min)   [MEDIUM]
--  Rule 3  : Dormant account sudden activity (30-day gap)  [HIGH]
--  Rule 4  : Round-number / structuring pattern            [LOW]
--  Rule 5  : High daily velocity  (10+ txns / 24 hrs)      [MEDIUM]
--  Rule 6  : Amount anomaly vs. sender's own avg  (5×)     [HIGH]
--  Rule 7  : Repeated same-receiver rapid transfers        [MEDIUM]
--  Rule 8  : New / unverified receiver + large amount      [HIGH]
-- ============================================================


-- ============================================================
-- TRIGGER 1A : before_transaction_insert
-- Runs BEFORE every INSERT on transactions.
-- Evaluates all 8 fraud rules and marks :NEW.status = 'flagged'
-- when any rule fires.  The row is still inserted — blocking
-- is intentionally left to the application layer.
-- ============================================================
CREATE OR REPLACE TRIGGER before_transaction_insert
BEFORE INSERT ON transactions
FOR EACH ROW
DECLARE
    v_recent_1min       NUMBER := 0;   -- txns in last 1 minute
    v_daily_count       NUMBER := 0;   -- txns in last 24 hours
    v_last_txn_date     DATE;          -- most recent prior txn date
    v_days_inactive     NUMBER := 0;   -- days since last activity
    v_avg_amount        NUMBER := 0;   -- sender's historical avg
    v_same_rcv_count    NUMBER := 0;   -- same receiver in 10 min
    v_receiver_count    NUMBER := 0;   -- total txns ever to this receiver
BEGIN

    -- --------------------------------------------------------
    -- Rule 1: Large transaction (> 50,000)
    -- A single high-value transfer is an immediate red flag.
    -- --------------------------------------------------------
    IF :NEW.amount > 50000 THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 2: Rapid successive transactions (3+ in 1 minute)
    -- Counts rows already committed for this sender in the
    -- last 60 seconds.  If 2 already exist, this is the 3rd.
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_recent_1min
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '1' MINUTE;

    IF v_recent_1min >= 2 THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 3: Dormant account sudden activity
    -- If the account had no transactions for 30+ days AND
    -- the new amount is significant (> 10,000), flag it.
    -- --------------------------------------------------------
    SELECT MAX(CAST(created_at AS DATE))
    INTO   v_last_txn_date
    FROM   transactions
    WHERE  sender_id = :NEW.sender_id;

    IF v_last_txn_date IS NOT NULL THEN
        v_days_inactive := SYSDATE - v_last_txn_date;
        IF v_days_inactive > 30 AND :NEW.amount > 10000 THEN
            :NEW.status := 'flagged';
        END IF;
    END IF;

    -- --------------------------------------------------------
    -- Rule 4: Round-number / structuring pattern
    -- Amounts that are exact multiples of 10,000 are a classic
    -- structuring signal used to avoid reporting thresholds.
    -- --------------------------------------------------------
    IF MOD(:NEW.amount, 10000) = 0 AND :NEW.amount >= 10000 THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 5: High daily velocity (10+ transactions / 24 hrs)
    -- Catches distributed low-value fraud spread across a day.
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_daily_count
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '24' HOUR;

    IF v_daily_count >= 10 THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 6: Amount anomaly — 5× the sender's own average
    -- Personalised baseline: flags a sudden spike for THIS
    -- user, not just a global threshold.
    -- --------------------------------------------------------
    SELECT NVL(AVG(amount), 0)
    INTO   v_avg_amount
    FROM   transactions
    WHERE  sender_id = :NEW.sender_id;

    IF v_avg_amount > 0 AND :NEW.amount > (v_avg_amount * 5) THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 7: Repeated same-receiver rapid transfers
    -- 3+ transfers to the exact same receiver within 10 minutes
    -- is a textbook smurfing / layering pattern.
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_same_rcv_count
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  receiver_id = :NEW.receiver_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '10' MINUTE;

    IF v_same_rcv_count >= 3 THEN
        :NEW.status := 'flagged';
    END IF;

    -- --------------------------------------------------------
    -- Rule 8: New / unverified receiver + large amount
    -- If this sender has NEVER sent to this receiver before
    -- AND the amount is > 20,000, flag as suspicious.
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_receiver_count
    FROM   transactions
    WHERE  sender_id   = :NEW.sender_id
      AND  receiver_id = :NEW.receiver_id;

    IF v_receiver_count = 0 AND :NEW.amount > 20000 THEN
        :NEW.status := 'flagged';
    END IF;

END;
/


-- ============================================================
-- TRIGGER 1B : after_transaction_insert
-- Runs AFTER every INSERT on transactions.
-- Reads the (already committed) :NEW values and inserts one
-- fraud_alerts row per rule that fired.  Keeping evaluation
-- logic only in 1A ensures we never double-count.
-- ============================================================
CREATE OR REPLACE TRIGGER after_transaction_insert
AFTER INSERT ON transactions
FOR EACH ROW
DECLARE
    v_recent_1min       NUMBER := 0;
    v_daily_count       NUMBER := 0;
    v_last_txn_date     DATE;
    v_days_inactive     NUMBER := 0;
    v_avg_amount        NUMBER := 0;
    v_same_rcv_count    NUMBER := 0;
    v_receiver_count    NUMBER := 0;
BEGIN

    -- Only proceed if the transaction was flagged
    IF :NEW.status != 'flagged' THEN
        RETURN;
    END IF;

    -- --------------------------------------------------------
    -- Rule 1 alert: Large transaction
    -- --------------------------------------------------------
    IF :NEW.amount > 50000 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'Large transaction amount exceeded 50,000',
            'high'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 2 alert: Rapid successive transactions
    -- Exclude the just-inserted row from the count.
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_recent_1min
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '1' MINUTE
      AND  txn_id    != :NEW.txn_id;

    IF v_recent_1min >= 2 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'Rapid successive transactions — 3 or more within 1 minute',
            'medium'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 3 alert: Dormant account sudden activity
    -- --------------------------------------------------------
    SELECT MAX(CAST(created_at AS DATE))
    INTO   v_last_txn_date
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  txn_id    != :NEW.txn_id;

    IF v_last_txn_date IS NOT NULL THEN
        v_days_inactive := SYSDATE - v_last_txn_date;
        IF v_days_inactive > 30 AND :NEW.amount > 10000 THEN
            INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
            VALUES (
                :NEW.txn_id,
                :NEW.sender_id,
                'Dormant account active after ' || FLOOR(v_days_inactive) || ' days with high-value transfer',
                'high'
            );
        END IF;
    END IF;

    -- --------------------------------------------------------
    -- Rule 4 alert: Round-number structuring
    -- --------------------------------------------------------
    IF MOD(:NEW.amount, 10000) = 0 AND :NEW.amount >= 10000 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'Round-number structuring pattern detected — amount is exact multiple of 10,000',
            'low'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 5 alert: High daily velocity
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_daily_count
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '24' HOUR
      AND  txn_id    != :NEW.txn_id;

    IF v_daily_count >= 10 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'High daily velocity — sender has made ' || v_daily_count || ' transactions in the past 24 hours',
            'medium'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 6 alert: Amount anomaly vs. personal average
    -- --------------------------------------------------------
    SELECT NVL(AVG(amount), 0)
    INTO   v_avg_amount
    FROM   transactions
    WHERE  sender_id  = :NEW.sender_id
      AND  txn_id    != :NEW.txn_id;

    IF v_avg_amount > 0 AND :NEW.amount > (v_avg_amount * 5) THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'Amount anomaly — transaction is more than 5x the sender personal average of ' || ROUND(v_avg_amount, 2),
            'high'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 7 alert: Repeated same-receiver rapid transfers
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_same_rcv_count
    FROM   transactions
    WHERE  sender_id   = :NEW.sender_id
      AND  receiver_id = :NEW.receiver_id
      AND  created_at >= SYSTIMESTAMP - INTERVAL '10' MINUTE
      AND  txn_id     != :NEW.txn_id;

    IF v_same_rcv_count >= 3 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'Smurfing pattern — ' || v_same_rcv_count || ' transfers to same receiver within 10 minutes',
            'medium'
        );
    END IF;

    -- --------------------------------------------------------
    -- Rule 8 alert: New receiver + large amount
    -- --------------------------------------------------------
    SELECT COUNT(*)
    INTO   v_receiver_count
    FROM   transactions
    WHERE  sender_id   = :NEW.sender_id
      AND  receiver_id = :NEW.receiver_id
      AND  txn_id     != :NEW.txn_id;

    IF v_receiver_count = 0 AND :NEW.amount > 20000 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (
            :NEW.txn_id,
            :NEW.sender_id,
            'First-time transfer to unverified receiver with high-value amount',
            'high'
        );
    END IF;

END;
/


-- ============================================================
-- TRIGGER 2 : prevent_audit_delete
-- Immutability guarantee — no row in audit_log can ever be
-- deleted, regardless of user privilege.
-- ============================================================
CREATE OR REPLACE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
    RAISE_APPLICATION_ERROR(
        -20001,
        'FORBIDDEN: Audit log records are immutable and cannot be deleted.'
    );
END;
/


-- ============================================================
-- TRIGGER 3 : prevent_transaction_delete
-- Ledger integrity — once a transaction is written, it stays.
-- ============================================================
CREATE OR REPLACE TRIGGER prevent_transaction_delete
BEFORE DELETE ON transactions
FOR EACH ROW
BEGIN
    RAISE_APPLICATION_ERROR(
        -20002,
        'FORBIDDEN: Transaction records are immutable and cannot be deleted.'
    );
END;
/


-- ============================================================
-- TRIGGER 4 : prevent_transaction_update
-- Immutability extension — no field on a committed transaction
-- should ever be changed (amount, status, receiver, etc.).
-- ============================================================
CREATE OR REPLACE TRIGGER prevent_transaction_update
BEFORE UPDATE ON transactions
FOR EACH ROW
BEGIN
    RAISE_APPLICATION_ERROR(
        -20003,
        'FORBIDDEN: Transaction records are immutable and cannot be updated.'
    );
END;
/


-- ============================================================
-- TRIGGER 5 : auto_audit_log
-- Every INSERT on transactions automatically writes a row to
-- audit_log so there is always a full paper trail — even if
-- the application layer forgets to log.
-- ============================================================
CREATE OR REPLACE TRIGGER audit_transactions
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
BEGIN

    -- =========================
    -- INSERT AUDIT
    -- =========================
    IF INSERTING THEN

        INSERT INTO audit_log (
            actor_id,
            action_type,
            target_table,
            target_id,
            new_value,
            created_at
        )
        VALUES (
            :NEW.sender_id,
            'INSERT',
            'TRANSACTIONS',
            :NEW.txn_id,

            TO_CLOB(
                '{' ||
                '"txn_id":' || :NEW.txn_id || ',' ||
                '"sender_id":' || :NEW.sender_id || ',' ||
                '"receiver_id":' || :NEW.receiver_id || ',' ||
                '"amount":' || :NEW.amount || ',' ||
                '"status":"' || :NEW.status || '"' ||
                '}'
            ),

            CURRENT_TIMESTAMP
        );

    END IF;

    -- =========================
    -- UPDATE AUDIT
    -- =========================
    IF UPDATING THEN

        INSERT INTO audit_log (
            actor_id,
            action_type,
            target_table,
            target_id,
            old_value,
            new_value,
            created_at
        )
        VALUES (
            :NEW.sender_id,
            'UPDATE',
            'TRANSACTIONS',
            :NEW.txn_id,

            TO_CLOB(
                '{' ||
                '"amount":' || :OLD.amount || ',' ||
                '"status":"' || :OLD.status || '"' ||
                '}'
            ),

            TO_CLOB(
                '{' ||
                '"amount":' || :NEW.amount || ',' ||
                '"status":"' || :NEW.status || '"' ||
                '}'
            ),

            CURRENT_TIMESTAMP
        );
    END IF;

END;
/
-- ============================================================
-- END OF TRIGGER SUITE
-- Total triggers  : 6
-- Fraud rules     : 8  (Rules 1-8 in TRIGGER 1A + 1B)
-- Immutability    : 3  (delete blocked on txn + audit,
--                       update blocked on txn)
-- Auto-auditing   : 1  (every insert auto-logged)
-- ============================================================
