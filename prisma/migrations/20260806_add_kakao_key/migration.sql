-- AlterTable: User 카카오 OAuth 연동 ID 추가
ALTER TABLE `User` ADD COLUMN `kakaoKey` VARCHAR(191) NULL;
ALTER TABLE `User` ADD UNIQUE INDEX `User_kakaoKey_key`(`kakaoKey`);
