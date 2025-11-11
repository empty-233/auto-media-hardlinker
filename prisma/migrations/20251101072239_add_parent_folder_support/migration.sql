-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "device_id" BIGINT NOT NULL,
    "inode" BIGINT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_path" TEXT NOT NULL,
    "link_path" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_directory" BOOLEAN NOT NULL DEFAULT false,
    "is_special_folder" BOOLEAN NOT NULL DEFAULT false,
    "folder_type" TEXT,
    "is_multi_disc" BOOLEAN NOT NULL DEFAULT false,
    "disc_number" INTEGER,
    "is_parent_folder" BOOLEAN NOT NULL DEFAULT false,
    "parent_folder_id" INTEGER,
    "mediaId" INTEGER,
    "episode_info_id" INTEGER,
    CONSTRAINT "File_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "File_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "File_episode_info_id_fkey" FOREIGN KEY ("episode_info_id") REFERENCES "EpisodeInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_File" ("created_at", "device_id", "disc_number", "episode_info_id", "file_hash", "file_path", "file_size", "folder_type", "id", "inode", "is_directory", "is_multi_disc", "is_special_folder", "link_path", "mediaId") SELECT "created_at", "device_id", "disc_number", "episode_info_id", "file_hash", "file_path", "file_size", "folder_type", "id", "inode", "is_directory", "is_multi_disc", "is_special_folder", "link_path", "mediaId" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE UNIQUE INDEX "File_file_path_key" ON "File"("file_path");
CREATE UNIQUE INDEX "File_link_path_key" ON "File"("link_path");
CREATE UNIQUE INDEX "File_episode_info_id_key" ON "File"("episode_info_id");
CREATE INDEX "File_file_hash_idx" ON "File"("file_hash");
CREATE INDEX "File_is_directory_idx" ON "File"("is_directory");
CREATE INDEX "File_is_special_folder_idx" ON "File"("is_special_folder");
CREATE INDEX "File_folder_type_idx" ON "File"("folder_type");
CREATE INDEX "File_is_multi_disc_disc_number_idx" ON "File"("is_multi_disc", "disc_number");
CREATE INDEX "File_is_parent_folder_idx" ON "File"("is_parent_folder");
CREATE INDEX "File_parent_folder_id_idx" ON "File"("parent_folder_id");
CREATE UNIQUE INDEX "File_device_id_inode_key" ON "File"("device_id", "inode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
