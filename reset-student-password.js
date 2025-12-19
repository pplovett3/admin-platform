// 重置学生密码为 123456
db.users.updateOne(
  { phone: "13825355379" },
  { $set: { passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy" } }
);
print("Password reset for 13825355379 to: 123456");

