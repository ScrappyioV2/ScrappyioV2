#!/bin/bash
PGPASSWORD="Matrix@@@404" pg_dump -h db.qsvakjmkejdozloebhmt.supabase.co -U postgres -d postgres -p 5432 --no-owner --no-privileges > /tmp/backup.sql
