# FCMS CLOUD API v2 (DETAILED IMPLEMENTATION SPEC - LARAVEL SANCTUM)

## Overview
This document defines a **production-ready API specification** for FCMS Cloud v2.

- Tech Stack: Laravel + Docker
- Authentication: Laravel Sanctum (token-based)
- Clients: React Native + Web
- Architecture: REST API

---

# 🔐 AUTHENTICATION (SANCTUM)

## POST /api/v2/auth/signup

Creates:
- cloud account (owner)
- company

### Request
```json
{
  "company_name": "ABC Corp",
  "company_address": "Manila",
  "company_email": "company@example.com",
  "email": "owner@example.com",
  "password": "password123"
}
```

### Behavior:
- `email` must be unique
- password hashed (bcrypt)
- auto-create company
- auto-login (return token)

### Response
```json
{
  "status": "success",
  "message": "Account created successfully.",
  "data": {
    "account": {
      "id": "uuid",
      "email": "owner@example.com",
      "created_at": "timestamp"
    },
    "company": {
      "id": "uuid",
      "name": "ABC Corp",
      "address": "Manila"
    },
    "token": "plain_text_token"
  }
}
```

---

## POST /api/v2/auth/signin

### Request
```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```

### Response
```json
{
  "status": "success",
  "message": "Login successful.",
  "data": {
    "account": {},
    "company": {},
    "token": "plain_text_token"
  }
}
```

---

## POST /api/v2/auth/request-otp

### Request
```json
{
  "email": "owner@example.com"
}
```

### Response
```json
{
  "status": "success",
  "message": "OTP sent.",
  "data": {
    "request_id": "uuid",
    "expires_in": 300
  }
}
```

### Rules:
- OTP = 6 digits
- Stored hashed
- Expiry = 5 mins
- Rate limit (5/min)

---

## POST /api/v2/auth/verify-otp

### Request
```json
{
  "email": "owner@example.com",
  "otp": "123456",
  "request_id": "uuid"
}
```

### Response
```json
{
  "status": "success",
  "message": "OTP verified.",
  "data": {
    "token": "plain_text_token",
    "account": {},
    "company": {}
  }
}
```

---

## GET /api/v2/auth/me

### Headers
Authorization: Bearer {token}

### Response
```json
{
  "status": "success",
  "data": {
    "account": {},
    "company": {}
  }
}
```

---

## POST /api/v2/auth/logout

### Behavior
- Revoke current token

---

# 🏢 BRANCHES

## GET /api/v2/branches

### Query
?page=1&per_page=20

### Response
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "Main Branch",
      "address": "QC"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_pages": 1,
    "total_items": 1
  }
}
```

---

## POST /api/v2/branches

### Request
```json
{
  "name": "New Branch",
  "address": "Cebu"
}
```

### Response
```json
{
  "status": "success",
  "message": "Branch created.",
  "data": {
    "id": "uuid",
    "name": "New Branch",
    "address": "Cebu"
  }
}
```

### Authorization:
- owner/admin only

---

## GET /api/v2/branches/{id}

---

## PUT /api/v2/branches/{id}

---

## DELETE /api/v2/branches/{id} (soft delete)

---

# 📱 DEVICES

## POST /api/v2/devices/register

### Request
```json
{
  "device_name": "POS 1",
  "physical_device_id": "raw-id",
  "device_fingerprint": "fingerprint"
}
```

### Behavior:
- Generate `device_id` (UUID)
- Store hashed `physical_device_id`
- Return signed `device_token`


### Response
```json
{
  "status": "success",
  "data": {
    "device_id": "uuid",
    "device_token": "secure_token"
  }
}
```

---

## POST /api/v2/devices/assign-branch

### Request
```json
{
  "device_id": "uuid",
  "branch_id": "uuid",
  "force_reassign": false
}
```

### Rules:
- 1 device = 1 branch
- If already assigned:
  - reject unless `force_reassign = true`

### Response
```json
{
  "status": "success",
  "message": "Device assigned to branch."
}
```

---

## GET /api/v2/devices/me

### Response
```json
{
  "status": "success",
  "data": {
    "device": {
      "id": "uuid",
      "name": "POS 1"
    },
    "branch": {
      "id": "uuid",
      "name": "Main Branch"
    }
  }
}
```

---

## GET /api/v2/devices/lookup-branch

Example:
GET /devices/lookup-branch?device_id=xxx

---

 🔍 SAFE LOOKUPS

## POST /api/v2/auth/check-email

```json
{
  "email": ""
}
```

### Always returns:
```json
{
  "status": "success",
  "message": "If the email exists, instructions were sent."
}
```

---

# 📦 STANDARD RESPONSE FORMAT

## Success
```json
{
  "status": "success",
  "message": "",
  "data": {}, 
  "pagination": null // has pagination if data is array
}
```

## Error
```json
{
  "status": "error",
  "message": "",
  "errors": {}
}
```

---

# 🔒 SECURITY RULES

- Use HTTPS only
- Hash passwords (bcrypt)
- Hash physical device ID
- Rate limit auth endpoints
- Store tokens securely (Keychain/Keystore)

---

# 📱 USER JOURNEY

## New User
1. Signup
2. Verify OTP
3. Register Device
4. Assign Branch
5. Use App

## Existing User
1. Login
2. Register Device (if needed)
3. Assign Branch
4. Use App

---

# 🔥 FINAL

This document is designed so AI or developers can directly implement the system with minimal assumptions.
