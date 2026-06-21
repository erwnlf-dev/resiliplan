# SAP ERP Central Server DR Plan

**Disaster Recovery Plan**

---

## Plan Metadata

| Field | Value |
|-------|-------|
| Service | SAP ERP |
| Service Owner | Finance & Operations IT |
| Criticality | critical |
| RTO Target | 120 minutes (2h 0m) |
| RPO Target | 30 minutes (0h 30m) |
| Plan ID | `7769d7ac-1ba2-4121-8f38-a501cd0e987d` |
| Status | draft |
| Created | 2026-06-21T09:00:26.868Z |
| Last Updated | 2026-06-21T09:00:26.868Z |

## Plan Quality Score

**Score: 50/100 — FAIR**

- ✓ **Substantive section content** (+25) — 14/14 sections look substantive
- ✗ **Plan approved** (+20) — Plan is not approved yet
- ✗ **Section-level readiness** (+15) — 0/14 sections approved
- ✗ **Service and business owners** (+10) — Business owner or service owner missing
- ✓ **RTO/RPO targets** (+10) — RTO 120m / RPO 30m
- ✓ **Recovery strategy/context** (+10) — Recovery context exists
- ✗ **Audit evidence linked** (+5) — 0 evidence item(s)
- ✓ **Recently maintained** (+5) — Updated within 180 days

---

## Plan Sections

## 1. Context and Scope

*ISO 22301:2019 Clause 4* — 151 words

**Service:** SAP S/4HANA Central Server (CI + HANA DB, 2 TB)
**Service Owner:** Finance & Operations IT
**Criticality:** Tier-1 / Critical
**Audience:** DR Coordinator, Incident Commander, SAP Basis team, Integration owners, Exec Crisis Team

**In Scope**
- Primary SAP S/4HANA Central Instance, HANA database, Fiori front-end
- 12 satellite integrations (banking, payroll, warehouse, e-invoicing, etc.)
- 3,000 internal named users (FI/CO, MM, SD, PP, HCM)
- DR site compute, storage replication, network failover

**Out of Scope**
- Local satellite systems' own DR (handled at integration level)
- End-user devices, printers, network access layer
- Non-SAP analytics/reporting warehouses (daily refresh acceptable)

**Regulatory / Compliance Mapping**
- ISO 22301:2019 Clauses 4–10
- SOX (financial reporting integrity — FI/CO)
- GDPR (HCM/payroll personal data residency)
- Local e-invoicing mandates, tax authority retention rules

**Purpose:** Define how the SAP S/4HANA Central Server is recovered within RTO 120 min / RPO 30 min following a disruption.

---

## 2. Leadership and Ownership

*ISO 22301:2019 Clause 5* — 222 words

| Role | Name / Function | Responsibility |
|---|---|---|
| **Plan Owner** | Head of Finance & Operations IT | Accountable for DR plan lifecycle, budget, sign-off |
| **DR Coordinator** | SAP Basis Lead | Activates plan, coordinates technical recovery |
| **Incident Commander (IC)** | IT Service Continuity Manager | Declares disaster, owns command, go/no-go |
| **Approver** | CIO + CFO joint sign-off | Authorises invocation and stand-down |
| **SAP HANA DBA Lead** | Senior DBA | Database recovery, replication integrity |
| **Integration Lead** | Middleware/PI Owner | Restores 12 satellite interfaces |
| **Crisis Comms Lead** | Corporate Communications | Stakeholder messaging cadence |

**RACI Matrix (Recovery Phases)**

| Activity | Plan Owner | DR Coord | IC | SAP Basis | Integration | Comms |
|---|---|---|---|---|---|---|
| Declare disaster | A | C | R | I | I | I |
| Activate failover | A | R | C | C | C | I |
| Verify services | A | R | A | R | R | I |
| Communicate to users | A | C | A | I | I | R |
| Stand-down | R | C | R | I | I | I |

*ISO 22301 §5.2, §5.3 — leadership and roles.*

---

## 3. Planning and Objectives

*ISO 22301:2019 Clause 6* — 150 words

**Recovery Objectives**

| Metric | Target | Driver |
|---|---|---|
| **RTO** | 120 minutes | Maximum tolerable downtime before FI/CO posting halt causes material financial impact |
| **RPO** | 30 minutes | Last acceptable committed HANA transaction timestamp |
| **MBO** (Minimum Business Objective) | Restore FI/CO + payroll within RTO; MM/SD/PP within +60 min |

**Recovery Success Criteria**
1. HANA DB consistent and online at DR site
2. SAP application services (CI, ASCS, Fiori) started
3. All 12 satellite integration channels open and processing
4. Smoke test: one FI posting, one payroll record, one sales order round-trip succeeds
5. ≥ 95% of 3,000 users able to log on within 60 min post-declare

**Measurement**
- Real recovery time vs RTO recorded in DR register
- Real data loss vs RPO measured from last replicated log timestamp
- Quarterly KPI reporting to Risk Committee
*Aligned with ISO 22301 §6.2.*

---

## 4. Support and Resources

*ISO 22301:2019 Clause 7* — 134 words

**Resources & Tools**
- DR site (warm-standby, HANA System Replication + ASCS cluster replication)
- SAN replication (synchronous to metro, async to DR region)
- DNS failover automation (Route 53 / equivalent)
- SAP HANA Studio, SAP MMC, central monitoring (Solman)
- Pre-staged DR runbook binder + offline copies

**Budget (annual)**
- DR site hosting: €X
- Replication links: €Y
- 4 exercises: €Z
- 3rd-party DR advisor retainer: €W

**Vendor Contracts**
- Hyperscaler / co-lo DR site — 99.9% SLA, 4h restore of compute
- Storage replication vendor — RPO ≤ 5 min capability
- SAP Premium Engagement — escalation support

**Communication Channels**
- War-room bridge (Teams persistent channel)
- SMS tree via alerting tool (Everbridge/Similar)
- Status page (internal + customer-facing)
- Out-of-band phone tree (printed, sealed envelope)
*Per ISO 22301 §7.1.*

---

## 5. Operational Control

*ISO 22301:2019 Clause 8.1* — 136 words

**Day-to-Day Operational Controls (Pre-Event)**

1. **Replication Health**
   - HANA System Replication status checked every 5 min via Solman
   - SAN replication lag alert threshold: > 60 sec → page on-call
2. **Backup Cadence**
   - HANA full backup nightly 02:00, logs every 15 min
   - Backups replicated to DR region; restore-test monthly on a non-prod clone
3. **Monitoring**
   - 24/7 NOC watches SAP central services, ASCS, DB, integration middleware
   - Synthetic transaction (FI posting) every 30 min from probe
4. **Change Control**
   - All SAP transports gated by CAB; DR impact assessment required
   - Configuration drift between PRD and DR detected weekly
5. **Patch & Maintenance**
   - HANA revisions kept ≤ 1 quarter behind latest; DR site mirrored within 14 days
6. **Documentation Currency**
   - Runbook reviewed monthly; topology diagram regenerated quarterly
*Per ISO 22301 §8.1, §8.5.*

---

## 6. Business Impact Analysis

*ISO 22301:2019 Clause 8.2.2* — 236 words

**Business Impact Analysis Summary**

| Process | Module | Users Affected | 1h Impact | 4h Impact | 24h Impact | Tier |
|---|---|---|---|---|---|---|
| Financial posting / close | FI/CO | 800 | High — close blocked | Severe — audit risk | Critical — regulatory breach | **T1** |
| Payroll run | HCM + payroll int. | 3,000 (indirect) | Medium | High — missed pay | Critical — legal | **T1** |
| Sales order entry | SD | 600 | Medium | High — revenue loss | High | **T1** |
| Procurement / goods receipt | MM | 400 | Low | Medium — ops impact | High | **T2** |
| Production planning | PP | 350 | Low | Medium | High — plant stop | **T2** |
| Warehouse / outbound | WM + int. | 500 | Medium | High — SLA breach | High | **T1** |
| Banking interface | FI/bank | 800 | High | Critical — liquidity | Critical | **T1** |
| E-invoicing (legal) | SD/FI | External | Low | High — non-compliance | Critical | **T1** |

**Impact Time Bands (per ISO 22301 §6.2)**
- < 1h: tolerable for T2; rising concern for T1
- 1–4h: T1 enters escalation, customer comms activated
- > 24h: regulatory notification considered
**Tiering result:** 7 processes T1 → drive the 120 min RTO.

---

## 7. Risk Assessment

*ISO 22301:2019 Clause 8.2.3* — 190 words

**Top Threats (Likelihood × Impact)**

| Threat | Likelihood | Impact | Inherent Risk | Mitigation | Residual |
|---|---|---|---|---|---|
| Primary data centre outage | Medium | Severe | High | HANA SR + DR site warm | Low |
| HANA database corruption | Low | Severe | High | Daily backups + log replay, pre-flight checks | Medium |
| Cyberattack / ransomware | Medium | Severe | High | Immutable backups, MFA, network seg, IR plan | Medium |
| Replication link failure | Medium | High | High | Dual link, async fallback, monitoring | Low |
| Integration middleware failure | High | Medium | Medium | Redundant middleware, queue replay | Low |
| Cloud provider DR region failure | Low | Severe | Medium | Multi-AZ DR, quarterly failover proof | Low |
| Human error during recovery | Medium | High | High | Drills, two-person integrity, runbook automation | Medium |
| Loss of skilled SAP staff | Medium | High | Medium | Cross-training, external retainer | Medium |

*Reviewed quarterly; risk register linked to ERM.*
*ISO 22301 §6.1.*

---

## 8. Recovery Strategy

*ISO 22301:2019 Clause 8.3* — 156 words

**Chosen Strategy: Warm-Standby with Pilot-Light for Integrations**

**Rationale**
- RTO 120 min excludes backup-restore (HANA restore of 2 TB > 4 h) and cold-standby
- Hot-standby (active-active) deemed over-engineered for 3000 users with 99.9% availability target
- **SAP HANA System Replication** in SYNC (metro) + ASYNC to DR; DR instance pre-installed, HANA stopped, storage kept current via replication
- **ASCS cluster** replicated; switch-over scripted via SAP toolset
- **Pilot-light for integrations:** middleware at DR in low-power mode, auto-scaled on failover trigger
- **Backup-restore** retained as Tier-3 fallback (24 h RTO) for catastrophic scenario

**Why warm-standby meets RTO/RPO**
- HANA in pre-attached mode: takeover ≤ 15 min
- ASCS + CI start sequence: 20 min
- Integration health & smoke tests: 30 min
- DNS cutover + user logon wave: 35 min
- **Total ~100 min**, with 20-min contingency inside 120 min target

**Cost vs risk:** ~40% of hot-standby cost; 5× faster than backup-restore.
*ISO 22301 §8.3.*

---

## 9. Recovery Procedure

*ISO 22301:2019 Clause 8.4* — 165 words

**Runbook — Phased Recovery**

**Phase 0 — Detect & Declare (T0 → T+15 min)**
1. Monitoring alert fires (NOC) — auto-page IC, DR Coordinator
2. IC confirms outage, performs initial triage
3. If business impact = T1, IC declares **DISASTER** and authorises invocation
4. War-room opens; comms Lead drafts holding statement

**Phase 1 — Failover (T+15 → T+90 min)**
1. HANA SR takeover on DR site: `hdbnsutil -sr_takeover` (DBA Lead)
2. Verify DB consistency, start application services (ASCS, CI, Fiori)
3. Middleware auto-promotes DR adapters; integration queue replay begins
4. DNS failover: production CNAME → DR VIP (TTL 60 s)

**Phase 2 — Verification (T+90 → T+120 min)**
1. Smoke tests: FI posting, sales order, payroll interface, e-invoicing send
2. Integration health: 12/12 green
3. User wave logon: 95% in 60 min
4. IC declares **RECOVERED**

**Phase 3 — Stand-Down (within 48 h)**
1. Post-incident review, evidence pack to auditors
2. Decision: fail-back or operate at DR; if fail-back, schedule maintenance window
*ISO 22301 §8.5.2.*

---

## 10. Communication Plan

*ISO 22301:2019 Clause 8.4.3* — 184 words

**Stakeholder Map**

| Audience | Channel | Owner | Cadence |
|---|---|---|---|
| Executive / Crisis Team | War-room bridge + SMS | IC | At declare, every 30 min until recovered |
| 3,000 internal users | Email, Teams, intranet banner | Comms Lead | At declare, at T+60, at recovery, post-mortem |
| Integration partners (12) | Direct call + email | Integration Lead | At declare, at integration green |
| Regulators (tax, data protection) | Formal letter | CFO + Legal | Within 24 h if data-loss / breach |
| Customers (order delays) | Status page + account mgr | Comms Lead | At declare, hourly until recovered |
| Vendors / hyperscaler | Account manager | DR Coordinator | At declare, daily during outage |
| Audit / Risk Committee | Post-event report | Plan Owner | Within 5 business days |

**Escalation Tree**
NOC → IC (≤ 15 min) → CIO + CFO (≤ 30 min) → CEO (if > 4 h impact or regulatory).

**Pre-approved templates** for each audience held in comms vault.
*ISO 22301 §7.4.*

---

## 11. Validation and Acceptance Criteria

*ISO 22301:2019 Clause 8.5* — 200 words

**Acceptance Criteria (Pass/Fail Gates)**

| Gate | Test | Pass Threshold | Owner |
|---|---|---|---|
| G1 | HANA DB consistency check | Zero errors | DBA Lead |
| G2 | ASCS + CI services active | All green in MMC | Basis Lead |
| G3 | 12 satellite integrations | 12/12 sending + receiving test msg | Integration Lead |
| G4 | Smoke test — FI posting | Posts successfully to correct period | Functional Lead |
| G5 | Smoke test — sales order | Order created, delivery, invoice triggered | SD Lead |
| G6 | Smoke test — payroll file | Inbound file processed, no error | HCM Lead |
| G7 | E-invoicing outbound | Accepted by tax gateway | SD Lead |
| G8 | User logon rate | ≥ 95% of 3,000 users in 60 min | IC |
| G9 | Data integrity — last replicated log | Δ ≤ 30 min (RPO) | DBA Lead |
| G10 | Performance — S/4 transaction response | ≤ baseline + 20% | Basis Lead |

**Any gate FAIL = exercise not passed; trigger root-cause and re-test.**
*ISO 22301 §8.5.3, §9.2.*

---

## 12. Exercise and Testing Plan

*ISO 22301:2019 Clause 8.5* — 174 words

**Annual Test Schedule**

| Quarter | Type | Scope | Success Criteria |
|---|---|---|---|
| **Q1** | Tabletop | IC, DR Coord, Comms walk through declare → stand-down using scenario inject (ransomware on HANA) | All decisions made within 30 min of inject; gaps logged |
| **Q2** | Partial / Component | HANA SR takeover in isolated DR test instance; verify RTO 120, RPO 30 | Takeover ≤ 15 min, last log ≤ 30 min old |
| **Q3** | **Full Failover** | Production-like DR invocation (impactful, planned); 4-h maintenance window | All 10 validation gates pass; real RTO ≤ 120 min, RPO ≤ 30 min |
| **Q4** | **Surprise** | DR Coordinator receives simulated call without notice; on-call team executes partial failover of one module (e.g., HCM) | Recovery of chosen module within its RTO within 2 h of surprise trigger |

**Exercise Governance**
- Results logged in DR register; KPIs fed to performance section
- Failures generate corrective actions (see §14)
- Auditors invited annually to Q3
*ISO 22301 §9.2.2.*

---

## 13. Performance Evaluation

*ISO 22301:2019 Clause 9* — 159 words

**Key Performance Indicators**

| KPI | Target | Source |
|---|---|---|
| **RTO achieved** vs 120 min | ≤ 100% (≤ 120 min) | Exercise + real-event log |
| **RPO achieved** vs 30 min | ≤ 30 min data loss | Last replicated log timestamp |
| **Validation gates passed** | 10/10 in Q3 full exercise | Exercise report |
| **Mean time to declare** | ≤ 15 min from incident | IC log |
| **Communication dispatch time** | ≤ 20 min from declare | Comms log |
| **Exercise completion rate** | 4/4 per year | DR register |
| **Plan currency** | Reviewed within 90 days | Document mgmt. |
| **Corrective actions closed on time** | ≥ 90% | CA tracker |

**Review Cadence**
- **Monthly:** KPI snapshot to IT Risk
- **Quarterly:** trend report to Risk Committee with top 3 actions
- **Annually:** full plan review, BIA refresh, strategy reassessment
*ISO 22301 §9.3.*

---

## 14. Continual Improvement

*ISO 22301:2019 Clause 10* — 161 words

**Lessons Learned Process**
1. Within 5 business days post-event/exercise, IC convenes post-incident review (PIR)
2. PIR captures: timeline, decisions, gaps, near-misses, stakeholder feedback
3. Findings logged in DR improvement register with owner, severity, due date

**Corrective Action Workflow**

| Step | Owner | Output |
|---|---|---|
| 1. Identify finding | PIR participants | Logged in register |
| 2. Root-cause (5-Whys / fishbone) | DR Coordinator | RCA doc |
| 3. Action plan + owner + due date | Plan Owner | CA ticket |
| 4. Implementation | Action owner | Evidence (config, script, training) |
| 5. Verification | DR Coordinator | Re-test / sign-off |
| 6. Closure | Plan Owner | Audit trail |

**Version Update Rule**
- **Minor (≤ 2×/yr):** contact, tool, vendor changes
- **Major (annual or post-major incident):** strategy, BIA, RTO/RPO, structural changes
- All changes versioned in plan header, communicated to stakeholders, change-log retained
*ISO 22301 §10.1, §10.2 — Continual Improvement.*

---

## Document Control

| Field | Value |
|-------|-------|
| Document Type | DR Plan (Disaster Recovery) |
| Standard | ISO 22301:2019 — Security and resilience — Business continuity management systems |
| Generated by | ResiliPlan AI Plan Generator |
| AI Provider | Hermes (tokenrouter · MiniMax-M3) |
| Generated at | 2026-06-21 |
| Approval Status | DRAFT — Pending review and approval |
