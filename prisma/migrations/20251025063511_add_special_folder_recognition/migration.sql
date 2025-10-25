-- CreateTable
CREATE TABLE "Media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "release_date" DATETIME,
    "description" TEXT,
    "poster_url" TEXT,
    "tvInfoId" INTEGER,
    "movieInfoId" INTEGER,
    "collectionInfoId" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Media_tvInfoId_fkey" FOREIGN KEY ("tvInfoId") REFERENCES "TvInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_movieInfoId_fkey" FOREIGN KEY ("movieInfoId") REFERENCES "MovieInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_collectionInfoId_fkey" FOREIGN KEY ("collectionInfoId") REFERENCES "CollectionInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
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
    "mediaId" INTEGER,
    "episode_info_id" INTEGER,
    CONSTRAINT "File_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "File_episode_info_id_fkey" FOREIGN KEY ("episode_info_id") REFERENCES "EpisodeInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TvInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "MovieInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "CollectionInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "EpisodeInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tmdb_id" INTEGER NOT NULL,
    "season_number" INTEGER NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" TEXT,
    "release_date" DATETIME,
    "description" TEXT,
    "poster_url" TEXT,
    "tvInfoId" INTEGER,
    CONSTRAINT "EpisodeInfo_tvInfoId_fkey" FOREIGN KEY ("tvInfoId") REFERENCES "TvInfo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "is_directory" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "result" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "next_retry_at" DATETIME
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Library" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "path_hash" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "is_directory" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_processed_at" DATETIME,
    "file_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Library_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scan_time" DATETIME NOT NULL,
    "scan_path" TEXT NOT NULL,
    "files_found" INTEGER NOT NULL,
    "files_added" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "errors" TEXT,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Media_title_idx" ON "Media"("title");

-- CreateIndex
CREATE INDEX "Media_tmdb_id_idx" ON "Media"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "File_file_path_key" ON "File"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "File_link_path_key" ON "File"("link_path");

-- CreateIndex
CREATE UNIQUE INDEX "File_episode_info_id_key" ON "File"("episode_info_id");

-- CreateIndex
CREATE INDEX "File_file_hash_idx" ON "File"("file_hash");

-- CreateIndex
CREATE INDEX "File_is_directory_idx" ON "File"("is_directory");

-- CreateIndex
CREATE INDEX "File_is_special_folder_idx" ON "File"("is_special_folder");

-- CreateIndex
CREATE INDEX "File_folder_type_idx" ON "File"("folder_type");

-- CreateIndex
CREATE INDEX "File_is_multi_disc_disc_number_idx" ON "File"("is_multi_disc", "disc_number");

-- CreateIndex
CREATE UNIQUE INDEX "File_device_id_inode_key" ON "File"("device_id", "inode");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeInfo_tmdb_id_key" ON "EpisodeInfo"("tmdb_id");

-- CreateIndex
CREATE INDEX "Queue_status_priority_created_at_idx" ON "Queue"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "Queue_status_next_retry_at_idx" ON "Queue"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Library_path_key" ON "Library"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Library_file_id_key" ON "Library"("file_id");

-- CreateIndex
CREATE INDEX "Library_path_hash_idx" ON "Library"("path_hash");

-- CreateIndex
CREATE INDEX "Library_status_idx" ON "Library"("status");

-- CreateIndex
CREATE INDEX "Library_type_idx" ON "Library"("type");

-- CreateIndex
CREATE INDEX "Library_is_directory_idx" ON "Library"("is_directory");

-- CreateIndex
CREATE INDEX "ScanLog_scan_time_idx" ON "ScanLog"("scan_time");

-- CreateIndex
CREATE INDEX "ScanLog_status_idx" ON "ScanLog"("status");
