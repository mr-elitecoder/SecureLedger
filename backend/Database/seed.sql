-- ============================================================
-- SEED DATA — Testing ke liye
-- ============================================================

-- All users have password: password123
INSERT INTO
    users (
        full_name,
        email,
        password,
        balance,
        role
    )
VALUES (
        'Admin User',
        'admin@secureLedger.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        100000.00,
        'admin'
    ),
    (
        'Arslan Khan',
        'arslan@test.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        50000.00,
        'user'
    ),
    (
        'Ali Hassan',
        'ali@test.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        30000.00,
        'user'
    ),
    (
        'Sara Ahmed',
        'sara@test.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        20000.00,
        'user'
    );