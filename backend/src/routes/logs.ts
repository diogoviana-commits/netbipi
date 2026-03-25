import { Router } from 'express';
import { getLogs, createLog, getLogStats } from '../controllers/logController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getLogs);
router.get('/stats', getLogStats);
router.post('/', createLog);

export default router;
