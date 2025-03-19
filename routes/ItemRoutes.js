const express = require("express");
const router = express.Router();
const {
  CreateItem,
  GetAllItems,
  GetItem,
  DeleteItem,
  UpdateItem,
} = require("../controllers/ItemController");
const {
  CreateItemValidator,
  UpdateItemValidator,
  GetItemValidator,
  DeleteItemValidator,
} = require("../utils/Validators/ItemValid");

router.post("/", CreateItemValidator, CreateItem);
router.get("/", GetAllItems);
router.get("/:id", GetItemValidator, GetItem);
router.put("/:id", UpdateItemValidator, UpdateItem);
router.delete("/:id", DeleteItemValidator, DeleteItem);

module.exports = router;
