# NEXORA backup format (format_version 1)

A backup is a ZIP archive:

```
manifest.json
data/<table>.json           one JSON array of row objects per student-owned table
projects/<student_id>/<project_id>/<file>
```

`manifest.json`:

```json
{
  "format": "nexora-backup",
  "format_version": 1,
  "schema_revision": "0001_initial",
  "app_version": "0.1.0",
  "created_at": "2026-11-19T00:00:00",
  "student_ids": ["…uuid…"],
  "files": { "data/students.json": { "sha256": "…", "size": 123 }, "…": {} }
}
```

Tables: students, avatars, progress, assessments, submissions, skill_evidence, experiments, projects, conversations, conversation_messages, mentor_memory, achievements. Datetimes are ISO-8601 (UTC, naive). Catalog tables are not included - they are rebuilt from the curriculum.

**Import rules**: the archive is rejected unless every member path is relative and safe, there are no symlinks, sizes are within limits, the file list equals the manifest, every SHA-256 matches, and `schema_revision` is known to the running app (older revisions are accepted; unknown columns are ignored). Restoring replaces all data of the students listed in the manifest, inside one transaction, after copying the current database to `backups/pre-import-*.db`.
