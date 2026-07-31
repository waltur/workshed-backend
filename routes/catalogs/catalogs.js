const express = require('express');

const router = express.Router();

const { getCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem } = require('../../controllers/catalogs/catalogsController');

router.get('/:catalog', getCatalog);

router.post('/:catalog', createCatalogItem);

router.put('/:catalog/:id', updateCatalogItem);

router.delete('/:catalog/:id', deleteCatalogItem);

module.exports = router;