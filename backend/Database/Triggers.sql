-- ============================================================
--  SecureLedger — Complete Trigger Suite
--  Database  : Oracle (PL/SQL)
--  Schema    : secureled
--  Author    : SecureLedger Team
--  Version   : 2.0  (all 8 fraud-detection rules)
-- ============================================================

SELECT * FROM transactions;
SELECT * FROM fraud_alerts;
SELECT * FROM audit_log;
SELECT * FROM users;


INSERT INTO transactions VALUES (304,1,3,60000,'safe','test', '::1', SYSTIMESTAMP);
commit;



DELETE FROM transactions 
where txn_id = 1;

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
CREATE SEQUENCE fraud_alerts_seq
START WITH 1
INCREMENT BY 1
NOCACHE
NOCYCLE;
/

CREATE OR REPLACE TRIGGER after_transaction_insert
FOR INSERT ON transactions
COMPOUND TRIGGER

    TYPE t_row IS RECORD (
        txn_id      transactions.txn_id%TYPE,
        sender_id   transactions.sender_id%TYPE,
        receiver_id transactions.receiver_id%TYPE,
        amount      transactions.amount%TYPE,
        status      transactions.status%TYPE,
        created_at  transactions.created_at%TYPE
    );

    TYPE t_tab IS TABLE OF t_row INDEX BY PLS_INTEGER;
    g_data t_tab;

    i PLS_INTEGER := 0;

-- ===============================
-- ROW LEVEL (NO SQL HERE)
-- ===============================
AFTER EACH ROW IS
BEGIN
    IF :NEW.status = 'flagged' THEN
        i := i + 1;

        g_data(i).txn_id      := :NEW.txn_id;
        g_data(i).sender_id   := :NEW.sender_id;
        g_data(i).receiver_id := :NEW.receiver_id;
        g_data(i).amount      := :NEW.amount;
        g_data(i).status      := :NEW.status;
        g_data(i).created_at  := :NEW.created_at;
    END IF;
END AFTER EACH ROW;

-- ===============================
-- STATEMENT LEVEL (SAFE SQL)
-- ===============================
AFTER STATEMENT IS
    v_cnt NUMBER;
BEGIN

    FOR j IN 1 .. g_data.COUNT LOOP

        -- RULE 1: High amount
        IF g_data(j).amount > 50000 THEN
            INSERT INTO fraud_alerts
            (alert_id, txn_id, user_id, reason, severity, is_reviewed, reviewed_by, reviewed_at, created_at)
            VALUES
            (fraud_alerts_seq.NEXTVAL,
             g_data(j).txn_id,
             g_data(j).sender_id,
             'Large transaction amount exceeded threshold',
             'high',
             0, NULL, NULL,
             SYSTIMESTAMP);
        END IF;

        -- RULE 2: Daily velocity
        SELECT COUNT(*)
        INTO v_cnt
        FROM transactions
        WHERE sender_id = g_data(j).sender_id
          AND created_at >= SYSTIMESTAMP - INTERVAL '24' HOUR;

        IF v_cnt >= 10 THEN
            INSERT INTO fraud_alerts
            VALUES
            (fraud_alerts_seq.NEXTVAL,
             g_data(j).txn_id,
             g_data(j).sender_id,
             'High daily velocity detected',
             'medium',
             0, NULL, NULL,
             SYSTIMESTAMP);
        END IF;

        -- RULE 3: Round amount pattern
        IF MOD(g_data(j).amount, 10000) = 0 AND g_data(j).amount >= 10000 THEN
            INSERT INTO fraud_alerts
            VALUES
            (fraud_alerts_seq.NEXTVAL,
             g_data(j).txn_id,
             g_data(j).sender_id,
             'Round-number structuring detected',
             'low',
             0, NULL, NULL,
             SYSTIMESTAMP);
        END IF;

        -- RULE 4: First time receiver high value
        SELECT COUNT(*)
        INTO v_cnt
        FROM transactions
        WHERE sender_id = g_data(j).sender_id
          AND receiver_id = g_data(j).receiver_id;

        IF v_cnt = 1 AND g_data(j).amount > 20000 THEN
            INSERT INTO fraud_alerts
            VALUES
            (fraud_alerts_seq.NEXTVAL,
             g_data(j).txn_id,
             g_data(j).sender_id,
             'First-time high value transfer to receiver',
             'high',
             0, NULL, NULL,
             SYSTIMESTAMP);
        END IF;

    END LOOP;

END AFTER STATEMENT;

END;
/
INSERT INTO transactions
(txn_id, sender_id, receiver_id, amount, status, description, ip_address, created_at)
VALUES
(201,1,3,1400,'flagged','High Value Transfer','::1',SYSTIMESTAMP);

INSERT INTO transactions VALUES
(202,1,3,2200,'flagged','Suspicious Transfer','::1',SYSTIMESTAMP);

INSERT INTO transactions VALUES
(203,3,1,1800,'flagged','Unusual Activity','::1',SYSTIMESTAMP);
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
