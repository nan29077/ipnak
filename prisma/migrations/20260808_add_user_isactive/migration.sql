-- User 활동정지 기능: isActive 컬럼 추가
-- 기존 모든 회원은 활성(true) 상태로 시작
ALTER TABLE `User` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
