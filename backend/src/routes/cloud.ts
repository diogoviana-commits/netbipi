import { Router } from 'express';
import { getCloudStatus, getCloudMetrics, getCloudAlerts } from '../controllers/cloudController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/status', getCloudStatus);
router.get('/metrics', getCloudMetrics);
router.get('/alerts', getCloudAlerts);

export default router;
