"""
SQLite online backup and restore utility for ProjectPilot AI.

Usage:
    python scripts/backup_restore.py backup backend/projectpilot.db backups/projectpilot_backup.db
    python scripts/backup_restore.py restore backups/projectpilot_backup.db backend/projectpilot.db
"""
import argparse
from pathlib import Path
import sqlite3


def sqlite_copy(src_path: Path, dst_path: Path) -> None:
    if not src_path.exists():
        raise FileNotFoundError(f"Source database does not exist: {src_path}")
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    src_conn = sqlite3.connect(str(src_path))
    dst_conn = sqlite3.connect(str(dst_path))
    try:
        with dst_conn:
            src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backup or restore ProjectPilot AI SQLite database.")
    parser.add_argument("action", choices=["backup", "restore"], help="Action to perform")
    parser.add_argument("source", type=Path, help="Source SQLite database file")
    parser.add_argument("destination", type=Path, help="Destination SQLite database file")
    args = parser.parse_args()

    sqlite_copy(args.source, args.destination)
    print(f"Successfully completed {args.action}: {args.source} -> {args.destination}")


if __name__ == "__main__":
    main()
