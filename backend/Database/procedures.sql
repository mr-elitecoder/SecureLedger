-- ============================================================
-- STORED PROCEDURE 1: transfer_funds
-- Node.js calls this — it handles the full transfer atomically
-- ============================================================

DELIMITER $$

CREATE PROCEDURE transfer_funds(
    IN  p_sender_id    INT,
    IN  p_receiver_id  INT,
    IN  p_amount       DECIMAL(15,2),
    IN  p_description  VARCHAR(255),
    IN  p_ip_address   VARCHAR(45),
    OUT p_result       VARCHAR(100)    -- success message or error
)
proc_body: BEGIN
    DECLARE sender_balance DECIMAL(15,2);
    DECLARE txn_id_new     INT;

    -- Start transaction
    START TRANSACTION;

    -- Lock sender row for update (prevent race conditions)
    SELECT balance INTO sender_balance
    FROM users
    WHERE user_id = p_sender_id AND is_active = TRUE
    FOR UPDATE;

    -- Check if sender exists and is active
    IF sender_balance IS NULL THEN
        ROLLBACK;
        SET p_result = 'ERROR: Sender account not found or inactive';
        LEAVE proc_body;  -- exit procedure
    END IF;

    -- Check sufficient balance
    IF sender_balance < p_amount THEN
        ROLLBACK;
        SET p_result = 'ERROR: Insufficient balance';
        LEAVE proc_body;
    END IF;

    -- Check receiver exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_receiver_id AND is_active = TRUE) THEN
        ROLLBACK;
        SET p_result = 'ERROR: Receiver account not found or inactive';
        LEAVE proc_body;
    END IF;

    -- Deduct from sender
    UPDATE users SET balance = balance - p_amount WHERE user_id = p_sender_id;

    -- Credit to receiver
    UPDATE users SET balance = balance + p_amount WHERE user_id = p_receiver_id;

    -- Insert transaction record
    INSERT INTO transactions (sender_id, receiver_id, amount, status, description, ip_address)
    VALUES (p_sender_id, p_receiver_id, p_amount, 'completed', p_description, p_ip_address);

    SET txn_id_new = LAST_INSERT_ID();

    -- Audit log entry
    INSERT INTO audit_log (actor_id, action_type, target_table, target_id, new_value)
    VALUES (
        p_sender_id,
        'TRANSFER',
        'transactions',
        txn_id_new,
        JSON_OBJECT(
            'sender_id',   p_sender_id,
            'receiver_id', p_receiver_id,
            'amount',      p_amount
        )
    );

    COMMIT;
    SET p_result = CONCAT('SUCCESS: Transaction ID ', txn_id_new);

END$$

DELIMITER;

-- ============================================================
-- STORED PROCEDURE 2: get_transaction_history
-- User ka apna transaction history fetch karna
-- ============================================================

DELIMITER $$

CREATE PROCEDURE get_transaction_history(
    IN p_user_id INT,
    IN p_limit   INT
)
proc_body: BEGIN
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
        fa.reason AS fraud_reason
    FROM transactions t
    LEFT JOIN users s ON t.sender_id   = s.user_id
    LEFT JOIN users r ON t.receiver_id = r.user_id
    LEFT JOIN fraud_alerts fa ON fa.txn_id = t.txn_id
    WHERE t.sender_id = p_user_id OR t.receiver_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT p_limit;
END$$

DELIMITER;