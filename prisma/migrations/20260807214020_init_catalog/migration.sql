-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "previewUrl" TEXT,
    "trackId" TEXT NOT NULL DEFAULT '',
    "exampleArtist" TEXT,
    "exampleTrack" TEXT,
    "engemap" TEXT NOT NULL DEFAULT '',
    "playlistUrl" TEXT NOT NULL DEFAULT '',
    "artists" JSONB NOT NULL DEFAULT '[]',
    "artistsPinned" BOOLEAN NOT NULL DEFAULT false,
    "coverUrl" TEXT,
    "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistFan" (
    "artistId" TEXT NOT NULL,
    "fans" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistFan_pkey" PRIMARY KEY ("artistId")
);

-- CreateTable
CREATE TABLE "CatalogMeta" (
    "key" TEXT NOT NULL,
    "catalogUpdatedAt" TEXT,
    "source" TEXT,
    "method" TEXT,
    "count" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogMeta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Genre_name_idx" ON "Genre"("name");
