-- AlterTable: User 약관 동의 필드 추가 (위치정보법 준수)
ALTER TABLE `User` ADD COLUMN `termsConsent` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `privacyConsent` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `locationConsent` BOOLEAN NOT NULL DEFAULT false;
