// 重置学生密码为 123456
db.users.updateOne(
  { phone: "13825355379" },
  { $set: { passwordHash: "$2b$10$XikLl9G4QNtjBFpToAcGV.04kga2rSxZiYxpdjeUtdsX.n76PUFG." } }
);
print("Password reset for 13825355379 to: 123456");

