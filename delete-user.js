const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.delete({ where: { email: '29077@hanmail.net' } })
  .then(r => console.log('삭제 완료:', r.email))
  .catch(e => console.error('에러:', e.message))
  .finally(() => p.$disconnect());
