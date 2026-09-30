#!/usr/bin/env bash
# One-time backend setup for DevNotes. Run after `appwrite login`.
# Re-runnable: "already exists" errors are harmless.
DB=devnotes
aw() { echo "> appwrite $*"; appwrite "$@" -f 2>&1 | grep -vE '^\s*$|Info:'; }
col() { local type=$1 table=$2 key=$3; shift 3; aw tables-db "create-$type-column" --database-id $DB --table-id "$table" --key "$key" "$@"; }

aw tables-db create --database-id $DB --name DevNotes
for t in folders notes; do
  aw tables-db create-table --database-id $DB --table-id $t --name $t --row-security --permissions 'create("users")'
done

col varchar folders name     --size 256 --required=true
col varchar folders parentId --size 36  --required=false
col varchar folders userId   --size 36  --required=true

col varchar  notes title      --size 512 --required=true
col varchar  notes folderId   --size 36  --required=false
col varchar  notes userId     --size 36  --required=true
col longtext notes blocks     --required=false
col longtext notes searchText --required=false
col boolean  notes isPublic   --required=false --xdefault=false

echo 'Waiting for columns...'; sleep 10
aw tables-db create-index --database-id $DB --table-id folders --key by_user --type key --columns userId
aw tables-db create-index --database-id $DB --table-id notes   --key by_user --type key --columns userId

ext=(); for e in png jpg jpeg gif webp svg bmp; do ext+=(--allowed-file-extensions "$e"); done
aw storage create-bucket --bucket-id note-images --name 'Note images' --file-security \
  --permissions 'create("users")' --maximum-file-size 30000000 "${ext[@]}" --transformations --enabled
echo Done.
