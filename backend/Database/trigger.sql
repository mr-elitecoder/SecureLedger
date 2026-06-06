-- ============================================================
-- TRIGGER 1: after_transaction_insert
-- Transaction insert ke baad automatically fraud check
-- Conditions:
--   1. Amount > 50000 → high severity
--   2. Same sender ne 1 minute mein 3+ transactions ki → medium severity
-- ============================================================

DELIMITER $$

CREATE TRIGGER after_transaction_insert
AFTER INSERT ON transactions
FOR EACH ROW
proc_body: BEGIN
    DECLARE recent_txn_count INT;

    -- Rule 1: Large transaction check
    IF NEW.amount > 50000 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (NEW.txn_id, NEW.sender_id, 'Large transaction amount (> 50,000)', 'high');

        UPDATE transactions SET status = 'flagged' WHERE txn_id = NEW.txn_id;
    END IF;

    -- Rule 2: Rapid transactions check (3+ in 1 minute)
    SELECT COUNT(*) INTO recent_txn_count
    FROM transactions
    WHERE sender_id = NEW.sender_id
      AND created_at >= NOW() - INTERVAL 1 MINUTE
      AND txn_id != NEW.txn_id;

    IF recent_txn_count >= 2 THEN
        INSERT INTO fraud_alerts (txn_id, user_id, reason, severity)
        VALUES (NEW.txn_id, NEW.sender_id, 'Rapid successive transactions (3+ in 1 min)', 'medium');

        UPDATE transactions SET status = 'flagged' WHERE txn_id = NEW.txn_id;
    END IF;

END$$

DELIMITER;

-- ============================================================
-- TRIGGER 2: prevent_audit_delete
-- Audit log se koi bhi delete nahi kar sakta — immutable
-- ============================================================

DELIMITER $$

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_log
FOR EACH ROW
proc_body: BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'FORBIDDEN: Audit log records cannot be deleted.';
END$$

DELIMITER;

-- ============================================================
-- TRIGGER 3: prevent_transaction_delete
-- Transactions bhi delete nahi hongi — ledger is immutable
-- ============================================================

DELIMITER $$

CREATE TRIGGER prevent_transaction_delete
BEFORE DELETE ON transactions
FOR EACH ROW
proc_body: BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'FORBIDDEN: Transaction records cannot be deleted.';
END$$

DELIMITER;