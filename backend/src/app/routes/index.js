// merges all modules routes
import { Router } from 'express';
import { buildRouter } from './routeBuilder.js';

// modules routes
import { designRoutes } from '../../modules/design/routes/design.route.js';
import { stockInRoutes } from '../../modules/stock/routes/stockIn.route.js';
import { stockItemRoutes } from '../../modules/stock/routes/stockItem.route.js';
import { qrCenterRoutes } from '../../modules/stock/routes/qrCenter.route.js';
import { stockHistoryRoutes } from '../../modules/stock/routes/stockHistory.route.js';
import { tagPresetRoutes } from '../../modules/stock/routes/tagPreset.route.js';
import { stockTransformationRoutes } from '../../modules/stock/routes/stockTransformation.route.js';
import { currentStockRoutes } from '../../modules/inventory/routes/currentStock.route.js';
import { partyRoutes } from '../../modules/sales/routes/party.route.js';
import { orderFormRoutes } from '../../modules/sales/routes/orderForm.route.js';
import { invoiceRoutes } from '../../modules/sales/routes/invoice.route.js';
import { salesRoutes } from '../../modules/sales/routes/sales.route.js';

const router = Router();

router.use('/designs', buildRouter(designRoutes));
router.use('/stock-in', buildRouter(stockInRoutes));
router.use('/stock-items', buildRouter(stockItemRoutes));
router.use('/qr-center', buildRouter(qrCenterRoutes));
router.use('/stock-history', buildRouter(stockHistoryRoutes));
router.use('/tag-presets', buildRouter(tagPresetRoutes));
router.use('/current-stock', buildRouter(currentStockRoutes));
router.use('/stock-transformations', buildRouter(stockTransformationRoutes));
router.use('/parties', buildRouter(partyRoutes));
router.use('/order-forms', buildRouter(orderFormRoutes));
router.use('/invoices', buildRouter(invoiceRoutes));
router.use('/sales', buildRouter(salesRoutes));

export default router;
