

-- ============================================================
-- INDEXES — Safe creation (skip if already exists)
-- Oracle has no CREATE INDEX IF NOT EXISTS, so we use
-- a PL/SQL block that checks user_indexes first.
-- ============================================================
BEGIN
    -- transactions: single-column
    FOR i IN (
        SELECT index_name FROM (
            SELECT 'IDX_TXN_SENDER'       AS index_name, 'transactions' AS tbl, 'sender_id'                        AS cols FROM dual UNION ALL
            SELECT 'IDX_TXN_RECEIVER',     'transactions', 'receiver_id'                                           FROM dual UNION ALL
            SELECT 'IDX_TXN_CREATED',      'transactions', 'created_at'                                            FROM dual UNION ALL
            SELECT 'IDX_TXN_SENDER_TIME',  'transactions', 'sender_id, created_at'                                 FROM dual UNION ALL
            SELECT 'IDX_TXN_SNDR_RCVR_TIME','transactions','sender_id, receiver_id, created_at'                    FROM dual UNION ALL
            SELECT 'IDX_FRAUD_USER',        'fraud_alerts', 'user_id'                                              FROM dual UNION ALL
            SELECT 'IDX_FRAUD_TXN',         'fraud_alerts', 'txn_id'                                               FROM dual UNION ALL
            SELECT 'IDX_AUDIT_ACTOR',       'audit_log',    'actor_id'                                             FROM dual UNION ALL
            SELECT 'IDX_AUDIT_CREATED',     'audit_log',    'created_at'                                           FROM dual
        ) idx_list
        WHERE index_name NOT IN (
            SELECT index_name FROM user_indexes
        )
    ) LOOP
        -- This loop only runs for indexes that DON'T exist yet
        -- Nothing to do here — we use individual blocks below
        NULL;
    END LOOP;
END;
/

-- Individual safe blocks — one per index
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_TXN_SENDER';        IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_txn_sender         ON transactions (sender_id)';                          DBMS_OUTPUT.PUT_LINE('Created: idx_txn_sender');        ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_txn_sender (exists)');        END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_TXN_RECEIVER';      IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_txn_receiver       ON transactions (receiver_id)';                        DBMS_OUTPUT.PUT_LINE('Created: idx_txn_receiver');      ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_txn_receiver (exists)');      END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_TXN_CREATED';       IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_txn_created        ON transactions (created_at)';                         DBMS_OUTPUT.PUT_LINE('Created: idx_txn_created');       ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_txn_created (exists)');       END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_TXN_SENDER_TIME';   IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_txn_sender_time    ON transactions (sender_id, created_at)';               DBMS_OUTPUT.PUT_LINE('Created: idx_txn_sender_time');   ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_txn_sender_time (exists)');   END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_TXN_SNDR_RCVR_TIME';IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_txn_sndr_rcvr_time ON transactions (sender_id, receiver_id, created_at)'; DBMS_OUTPUT.PUT_LINE('Created: idx_txn_sndr_rcvr_time'); ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_txn_sndr_rcvr_time (exists)'); END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_FRAUD_USER';         IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_fraud_user         ON fraud_alerts (user_id)';                            DBMS_OUTPUT.PUT_LINE('Created: idx_fraud_user');         ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_fraud_user (exists)');         END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_FRAUD_TXN';          IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_fraud_txn          ON fraud_alerts (txn_id)';                             DBMS_OUTPUT.PUT_LINE('Created: idx_fraud_txn');          ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_fraud_txn (exists)');          END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_AUDIT_ACTOR';        IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_audit_actor        ON audit_log (actor_id)';                              DBMS_OUTPUT.PUT_LINE('Created: idx_audit_actor');        ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_audit_actor (exists)');        END IF; END;
/
DECLARE v_c NUMBER; BEGIN SELECT COUNT(*) INTO v_c FROM user_indexes WHERE index_name = 'IDX_AUDIT_CREATED';      IF v_c = 0 THEN EXECUTE IMMEDIATE 'CREATE INDEX idx_audit_created      ON audit_log (created_at)';                            DBMS_OUTPUT.PUT_LINE('Created: idx_audit_created');      ELSE DBMS_OUTPUT.PUT_LINE('Skipped: idx_audit_created (exists)');      END IF; END;
/


-- ============================================================
-- END OF FILE  |  SecureLedger v3.0
-- ============================================================

