-- ============================================================
--  SecureLedger — Complete Database Schema
--  ADBMS Final Project
--  Tech: MySQL 8.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS secureLedger;

USE secureLedger;

-- ============================================================
-- TABLE 1: users
-- Har user ka account yahan store hoga
-- ============================================================

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed (Node.js side)
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_balance CHECK (balance >= 0)
);

-- ============================================================
-- TABLE 2: transactions
-- Har transfer ka permanent record — kuch delete nahi hoga
-- ============================================================

CREATE TABLE transactions (
    txn_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status ENUM(
        'pending',
        'completed',
        'failed',
        'flagged'
    ) NOT NULL DEFAULT 'pending',
    description VARCHAR(255),
    ip_address VARCHAR(45), -- IPv4 or IPv6
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users (user_id),
    CONSTRAINT fk_receiver FOREIGN KEY (receiver_id) REFERENCES users (user_id),
    CONSTRAINT chk_amount CHECK (amount > 0),
    CONSTRAINT chk_not_self CHECK (sender_id != receiver_id)
);

-- ============================================================
-- TABLE 3: fraud_alerts
-- Jab bhi koi suspicious transaction detect ho — yahan record
-- ============================================================

CREATE TABLE fraud_alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    txn_id INT NOT NULL,
    user_id INT NOT NULL, -- user who triggered the alert
    reason VARCHAR(255) NOT NULL, -- e.g. "Rapid transactions", "Large amount"
    severity ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by INT, -- admin user_id
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert_txn FOREIGN KEY (txn_id) REFERENCES transactions (txn_id),
    CONSTRAINT fk_alert_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (user_id)
);

-- ============================================================
-- TABLE 4: audit_log
-- Immutable log — koi bhi operation yahan record hoga
-- No deletes allowed (enforced via trigger below)
-- ============================================================

CREATE TABLE audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT, -- user who performed the action
    action_type VARCHAR(50) NOT NULL, -- e.g. 'TRANSFER', 'LOGIN', 'FLAG'
    target_table VARCHAR(50),
    target_id INT, -- affected row id
    old_value JSON,
    new_value JSON,
    notes VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);