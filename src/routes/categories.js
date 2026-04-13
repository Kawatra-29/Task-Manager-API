const express = require('express');
const router  = express.Router();
const {
  createCategory, getAllCategories, getCategory,
  updateCategory, deleteCategory,
} = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const {
  createCategoryRules, updateCategoryRules,
  uuidParamRule, validate,
} = require('../validators');

router.use(authenticate);

router.post('/',     createCategoryRules, validate, createCategory);
router.get('/',      getAllCategories);
router.get('/:id',   uuidParamRule, validate, getCategory);
router.patch('/:id', uuidParamRule, updateCategoryRules, validate, updateCategory);
router.delete('/:id',uuidParamRule, validate, deleteCategory);

module.exports = router;