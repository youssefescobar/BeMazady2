const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
    creation_date: { type: Date, default: Date.now },
    address: { type: String },
    phone_number: { type: Number, unique: true, required: true },
    national_id: { type: Number, unique: true, required: true },
    user_picture: { type: String },
    favorite_list: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }] // References Item collection
});

module.exports = mongoose.model('User', UserSchema);
