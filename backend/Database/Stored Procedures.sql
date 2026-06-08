
show con_name;
alter session set container = XEPDB1;
CREATE USER secureledger IDENTIFIED BY Innovators;
SELECT username
FROM dba_users
WHERE username = 'SECURELEDGER';

-- Minimal recommended grants for application use:
GRANT CREATE SESSION TO appuser;

GRANT CREATE TABLE TO appuser;

GRANT CREATE SEQUENCE TO appuser;

GRANT CREATE PROCEDURE TO appuser;

-- If your application will create views, triggers or packages, grant those too:
GRANT CREATE VIEW TO appuser;

GRANT CREATE TRIGGER TO appuser;

GRANT CREATE TYPE TO appuser;

-- If stored procedures are in another schema (e.g., secureledger), grant execute on them:
-- GRANT EXECUTE ON secureledger.transfer_funds TO appuser;

-- OPTIONAL (NOT RECOMMENDED FOR PRODUCTION): Grant broad privileges
-- GRANT DBA TO appuser;

-- After running, note the username/password and update backend/.env accordingly.
-- ============================================================
-- SEQUENCE for transactions PK
-- Safe version: only creates if it doesn't already exist
-- ============================================================
-- Step 1: Enable output
SET SERVEROUTPUT ON;

-- Step 2: Run your block (select all and press F5)
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_sequences
    WHERE sequence_name = 'TXN_SEQ';
    
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE SEQUENCE txn_seq
                START WITH 1
                INCREMENT BY 1
                NOCACHE
                NOCYCLE
        ';
        DBMS_OUTPUT.PUT_LINE('Sequence txn_seq created.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Sequence txn_seq already exists — skipped.');
    END IF;
END;
/

-- ============================================================
-- PROCEDURE 1: transfer_funds
-- ============================================================
CREATE OR REPLACE PROCEDURE transfer_funds(
    p_sender_id    IN  NUMBER,
    p_receiver_id  IN  NUMBER,
    p_amount       IN  NUMBER,
    p_description  IN  VARCHAR2,
    p_ip_address   IN  VARCHAR2,
    p_result       OUT VARCHAR2
)
AS
    v_sender_balance   NUMBER(15,2);
    v_receiver_exists  NUMBER(10) := 0;
    v_txn_id_new       NUMBER(10);
    v_txn_status       VARCHAR2(20);
BEGIN

    -- Guard: amount must be positive
    IF p_amount IS NULL OR p_amount <= 0 THEN
        p_result := 'ERROR: Transaction amount must be greater than zero';
        RETURN;
    END IF;

    -- Self-transfer guard
    IF p_sender_id = p_receiver_id THEN
        p_result := 'ERROR: Sender and receiver cannot be the same account';
        RETURN;
    END IF;

    -- Lock sender row + read balance
    -- NO_DATA_FOUND = account doesn't exist or inactive
    BEGIN
        SELECT balance
        INTO   v_sender_balance
        FROM   users
        WHERE  user_id   = p_sender_id
          AND  is_active = 1
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_result := 'ERROR: Sender account not found or inactive';
            RETURN;
    END;

    -- Balance check
    IF v_sender_balance < p_amount THEN
        p_result := 'ERROR: Insufficient balance';
        RETURN;
    END IF;

    -- --------------------------------------------------------
    -- BUG 2 FIX: Receiver lock
    -- Old code: SELECT COUNT(*) FOR UPDATE  ← aggregate ignores FOR UPDATE silently
    -- New code: SELECT 1 FOR UPDATE + NO_DATA_FOUND handler  ← actually locks the row
    -- --------------------------------------------------------
    BEGIN
        SELECT 1
        INTO   v_receiver_exists
        FROM   users
        WHERE  user_id   = p_receiver_id
          AND  is_active = 1
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_result := 'ERROR: Receiver account not found or inactive';
            RETURN;
    END;

    -- Debit sender
    UPDATE users
    SET    balance = balance - p_amount
    WHERE  user_id = p_sender_id;

    -- Credit receiver
    UPDATE users
    SET    balance = balance + p_amount
    WHERE  user_id = p_receiver_id;

    -- Insert transaction
    -- Status = 'pending' intentionally — BEFORE trigger sets 'flagged' if fraud detected
    -- RETURNING INTO captures whatever status the trigger assigned
    INSERT INTO transactions (
        txn_id,
        sender_id,
        receiver_id,
        amount,
        status,
        description,
        ip_address,
        created_at
    )
    VALUES (
        txn_seq.NEXTVAL,
        p_sender_id,
        p_receiver_id,
        p_amount,
        'pending',
        p_description,
        p_ip_address,
        SYSTIMESTAMP
    )
    RETURNING txn_id, status INTO v_txn_id_new, v_txn_status;

    -- Audit handled by Trigger 5 automatically — no manual insert needed

    COMMIT;

    IF v_txn_status = 'flagged' THEN
        p_result := 'FLAGGED: Transaction ID ' || v_txn_id_new ||
                    ' completed but flagged for fraud review';
    ELSE
        p_result := 'SUCCESS: Transaction ID ' || v_txn_id_new;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_result := 'ERROR: ' || SQLERRM;
END transfer_funds;
/


-- Test transfer_funds
DECLARE
    v_result VARCHAR2(200);
BEGIN
    transfer_funds(
        p_sender_id   => 1,
        p_receiver_id => 2,
        p_amount      => 50000.00,
        p_description => 'Test Transfer',
        p_ip_address  => '127.0.0.1',
        p_result      => v_result
    );
    DBMS_OUTPUT.PUT_LINE('Result: ' || v_result);
END;
/


-- ============================================================
-- PROCEDURE 2: get_transaction_history
-- ============================================================
CREATE OR REPLACE PROCEDURE get_transaction_history(
    p_user_id  IN  NUMBER,
    p_limit    IN  NUMBER,
    p_cursor   OUT SYS_REFCURSOR
)
AS
BEGIN
    OPEN p_cursor FOR
        SELECT
            t.txn_id,
            t.amount,
            t.status,
            t.description,
            t.created_at,
            CASE
                WHEN t.sender_id = p_user_id THEN 'sent'
                ELSE 'received'
            END AS direction,
            CASE
                WHEN t.sender_id = p_user_id THEN r.full_name
                ELSE s.full_name
            END AS counterparty,
            -- --------------------------------------------------------
            -- BUG 1 FIX: ROWNUM before ORDER BY
            --
            -- WRONG (v2):
            --   SELECT fa.reason FROM fraud_alerts fa
            --   WHERE fa.txn_id = t.txn_id AND ROWNUM = 1
            --   ORDER BY DECODE(severity, ...)
            --   ↑ ROWNUM=1 fires first, picks random row, ORDER BY is useless
            --
            -- CORRECT (v3):
            --   Inner query: ORDER BY severity first
            --   Outer query: ROWNUM = 1 on already-sorted result
            -- --------------------------------------------------------
            (
                SELECT reason FROM (
                    SELECT fa.reason
                    FROM   fraud_alerts fa
                    WHERE  fa.txn_id = t.txn_id
                    ORDER BY DECODE(fa.severity, 'high', 1, 'medium', 2, 'low', 3, 4)
                )
                WHERE ROWNUM = 1
            ) AS fraud_reason
        FROM      transactions t
        LEFT JOIN users s ON t.sender_id   = s.user_id
        LEFT JOIN users r ON t.receiver_id = r.user_id
        WHERE t.sender_id   = p_user_id
           OR t.receiver_id = p_user_id
        ORDER BY t.created_at DESC
        FETCH FIRST p_limit ROWS ONLY;
END get_transaction_history;
/


-- ============================================================
-- Test get_transaction_history
-- BUG 4 FIX: was missing v_description and v_created_at
-- Cursor returns 8 columns — FETCH needs exactly 8 variables
-- ============================================================
DECLARE
    v_cursor      SYS_REFCURSOR;
    v_txn_id      NUMBER;
    v_amount      NUMBER;
    v_status      VARCHAR2(20);
    v_description VARCHAR2(255);   -- ← was missing in v2
    v_created_at  TIMESTAMP;       -- ← was missing in v2
    v_direction   VARCHAR2(10);
    v_party       VARCHAR2(100);
    v_reason      VARCHAR2(500);
BEGIN
    get_transaction_history(
        p_user_id => 1,
        p_limit   => 10,
        p_cursor  => v_cursor
    );
    LOOP
        FETCH v_cursor INTO
            v_txn_id,
            v_amount,
            v_status,
            v_description,
            v_created_at,
            v_direction,
            v_party,
            v_reason;
        EXIT WHEN v_cursor%NOTFOUND;
        DBMS_OUTPUT.PUT_LINE(
            'TXN: '    || v_txn_id      || ' | ' ||
            v_direction || ' | Amt: '   || v_amount ||
            ' | '       || v_status     ||
            ' | Party: '|| v_party      ||
            CASE WHEN v_reason IS NOT NULL
                 THEN ' | FRAUD: ' || v_reason
                 ELSE '' END
        );
    END LOOP;
    CLOSE v_cursor;
END;
/


-- ============================================================
-- PROCEDURE 3: get_fraud_dashboard
-- BUG 3 FIX: was returning duplicate rows (one per alert)
-- Now returns one row per transaction with aggregated alerts
-- ============================================================
CREATE OR REPLACE PROCEDURE get_fraud_dashboard(
    p_limit  IN  NUMBER,
    p_cursor OUT SYS_REFCURSOR
)
AS
BEGIN
    OPEN p_cursor FOR
        SELECT
            t.txn_id,
            t.amount,
            t.created_at,
            s.full_name                                   AS sender_name,
            r.full_name                                   AS receiver_name,
            t.ip_address,
            -- --------------------------------------------------------
            -- BUG 3 FIX: one row per txn, not one row per alert
            -- Collect all reasons in one field, show worst severity
            -- --------------------------------------------------------
            (
                SELECT LISTAGG(fa2.reason, ' | ')
                       WITHIN GROUP (ORDER BY
                           DECODE(fa2.severity, 'high', 1, 'medium', 2, 'low', 3, 4))
                FROM   fraud_alerts fa2
                WHERE  fa2.txn_id = t.txn_id
            )                                             AS all_fraud_reasons,
            (
                SELECT MIN(DECODE(fa3.severity, 'high', 1, 'medium', 2, 'low', 3, 4))
                FROM   fraud_alerts fa3
                WHERE  fa3.txn_id = t.txn_id
            )                                             AS severity_rank,
            (
                SELECT fa4.severity FROM (
                    SELECT fa4.severity
                    FROM   fraud_alerts fa4
                    WHERE  fa4.txn_id = t.txn_id
                    ORDER BY DECODE(fa4.severity, 'high', 1, 'medium', 2, 'low', 3, 4)
                ) fa4
                WHERE ROWNUM = 1
            )                                             AS worst_severity
        FROM      transactions t
        LEFT JOIN users s ON s.user_id = t.sender_id
        LEFT JOIN users r ON r.user_id = t.receiver_id
        WHERE t.status = 'flagged'
        ORDER BY
            (
                SELECT MIN(DECODE(fa5.severity, 'high', 1, 'medium', 2, 'low', 3, 4))
                FROM fraud_alerts fa5
                WHERE fa5.txn_id = t.txn_id
            ),
            t.created_at DESC
        FETCH FIRST p_limit ROWS ONLY;
END get_fraud_dashboard;
/
