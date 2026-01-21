import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // @ts-ignore
    await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING);
    console.log("Liên kết CSDL thành công!");

    // Remove legacy index causing duplicate key errors
    try {
      const collection = mongoose.connection.collection('friendrequests');
      const indexes = await collection.indexes();
      const legacyIndex = indexes.find(idx => idx.name === 'senderId_1_receiverId_1');

      if (legacyIndex) {
        await collection.dropIndex('senderId_1_receiverId_1');
        console.log("Đã xóa index cũ senderId_1_receiverId_1");
      }
    } catch (err) {
      console.log("Không thể xóa index cũ (có thể không tồn tại):", err.message);
    }

  } catch (error) {
    console.log("Lỗi khi kết nối CSDL:", error);
    process.exit(1);
  }
};
