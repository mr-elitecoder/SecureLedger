-- ============================================================
-- SecureLedger Schema (Oracle)
-- ============================================================

-- TABLE 1: USERS
CREATE TABLE users (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR2 (100) NOT NULL,
    email VARCHAR2 (150) NOT NULL UNIQUE,
    password VARCHAR2 (255) NOT NULL,
    balance NUMBER (15, 2) DEFAULT 10000.00 NOT NULL,
    role VARCHAR2 (10) DEFAULT 'user' NOT NULL,
    is_active NUMBER (1) DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_balance CHECK (balance >= 0),
    CONSTRAINT chk_role CHECK (role IN ('user', 'admin')),
    CONSTRAINT chk_is_active CHECK (is_active IN (0, 1))
);

-- Diagnostic statements removed to keep schema execution clean.

CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- ============================================================
-- TABLE 2: TRANSACTIONS
-- ============================================================

CREATE TABLE transactions (
    txn_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id NUMBER NOT NULL,
    receiver_id NUMBER NOT NULL,
    amount NUMBER (15, 2) NOT NULL,
    status VARCHAR2 (20) DEFAULT 'pending' NOT NULL,
    description VARCHAR2 (255),
    ip_address VARCHAR2 (45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users (user_id),
    CONSTRAINT fk_receiver FOREIGN KEY (receiver_id) REFERENCES users (user_id),
    CONSTRAINT chk_amount CHECK (amount > 0),
    CONSTRAINT chk_not_self CHECK (sender_id <> receiver_id),
    CONSTRAINT chk_txn_status CHECK (
        status IN (
            'pending',
            'completed',
            'failed',
            'flagged'
        )
    )
);

-- ============================================================
-- TABLE 3: FRAUD_ALERTS
-- ============================================================

CREATE TABLE fraud_alerts (
    alert_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    txn_id NUMBER NOT NULL,
    user_id NUMBER NOT NULL,
    reason VARCHAR2 (255) NOT NULL,
    severity VARCHAR2 (10) DEFAULT 'medium' NOT NULL,
    is_reviewed NUMBER (1) DEFAULT 0 NOT NULL,
    reviewed_by NUMBER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_alert_txn FOREIGN KEY (txn_id) REFERENCES transactions (txn_id),
    CONSTRAINT fk_alert_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (user_id),
    CONSTRAINT chk_severity CHECK (
        severity IN ('low', 'medium', 'high')
    ),
    CONSTRAINT chk_reviewed CHECK (is_reviewed IN (0, 1))
);

-- ============================================================
-- TABLE 4: AUDIT_LOG
-- ============================================================

CREATE TABLE audit_log (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id NUMBER,
    action_type VARCHAR2 (50) NOT NULL,
    target_table VARCHAR2 (50),
    target_id NUMBER,
    old_value CLOB CHECK (old_value IS JSON),
    new_value CLOB CHECK (new_value IS JSON),
    notes VARCHAR2 (255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);