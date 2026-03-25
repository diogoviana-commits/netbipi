import { Router } from 'express';
import {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  syncFromZabbix,
  getAlertStats,
} from '../controllers/alertController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAlerts);
router.get('/stats', getAlertStats);
router.get('/:id', getAlertById);
router.post('/sync', syncFromZabbix);
router.put('/:id/acknowledge', acknowledgeAlert);
router.put('/:id/resolve', resolveAlert);

export default router;
