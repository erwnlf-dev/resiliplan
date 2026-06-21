-- Phase 2.1: Add 'acronis' to integration_type enum
-- Acronis Cyber Protect is closed-source but PT Datacomm customers use it
-- Adapter uses public REST API via SaaS worker proxy

ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'acronis';
