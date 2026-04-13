const Category  = require('../models/Category');
const Task      = require('../models/Task');
const { AppError } = require('../middleware/errorHandler');

// POST /api/categories
const createCategory = async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;

    const category = await Category.create({
      name,
      color: color || '#6B7280',
      icon:  icon  || '📋',
      userId: req.user.id,
    });

    res.status(201).json({
      status: 'success',
      message: 'Category created successfully',
      data: { category },
    });
  } catch (err) { next(err); }
};

// GET /api/categories
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where:  { userId: req.user.id },
      order:  [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      data:   { categories },
    });
  } catch (err) { next(err); }
};

// GET /api/categories/:id
const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!category) return next(new AppError('Category not found', 404));

    res.status(200).json({ status: 'success', data: { category } });
  } catch (err) { next(err); }
};

// PATCH /api/categories/:id
const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!category) return next(new AppError('Category not found', 404));

    const { name, color, icon } = req.body;
    if (name  !== undefined) category.name  = name;
    if (color !== undefined) category.color = color;
    if (icon  !== undefined) category.icon  = icon;
    await category.save();

    // Propagate name change to denormalised field in tasks
    if (name !== undefined) {
      await Task.updateMany(
        { categoryId: req.params.id },
        { categoryName: name }
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (err) { next(err); }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!category) return next(new AppError('Category not found', 404));

    await category.destroy();

    // Unlink tasks that belonged to this category
    await Task.updateMany(
      { categoryId: req.params.id },
      { categoryId: null, categoryName: null }
    );

    res.status(200).json({
      status: 'success',
      message: 'Category deleted successfully',
    });
  } catch (err) { next(err); }
};

module.exports = {
  createCategory, getAllCategories, getCategory, updateCategory, deleteCategory,
};