# Enterprise Operations & IT Policy Manual

## 1. Remote Work & Equipment Policy (POL-2026-IT-004)

### Policy Identifier: POL-2026-IT-004
- **Applies To**: Full-time employees and contractors.
- **Hardware Provisioning**: Standard developer hardware bundle includes SKU `MAC-M3-PRO-32G` or `DELL-XPS16-64G`.
- **Security Standards**: All company laptops must run CrowdStrike Falcon endpoint protection agent version `7.12.0` or higher.
- **VPN Requirements**: Connections must route through GlobalProtect gateway `vpn.corp.enterprise.com`.

---

## 2. Expense Reimbursement & Travel Guidelines

### Document ID: FIN-EXP-8891
- **Per Diem Limit**: Meals and incidentals are capped at $85.00 per day for domestic travel.
- **Receipt Threshold**: Receipts required for any single expense exceeding $25.00.
- **Expense Codes**:
  - `EX-MEAL-01`: Client dining and team lunches.
  - `EX-TRVL-02`: Flight and train tickets.
  - `EX-SOFT-09`: Cloud software subscriptions (requires manager pre-approval).

---

## 3. Incident Response & On-Call Procedures

### Escalation Protocol: SEV-1 Outage
- **Response SLA**: Primary on-call engineer must acknowledge PagerDuty incident within 5 minutes.
- **War Room Protocol**: Open Zoom link `https://corp.zoom.us/j/9901827364` and notify `#incident-command` on Slack.
- **Post-Mortem**: Required within 48 hours for all severity 1 and severity 2 incidents.
