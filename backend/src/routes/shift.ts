import { Router } from 'express';
import { getShiftSummary, getHandoffReport } from '../controllers/shiftController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', getShiftSummary);
router.get('/handoff', getHandoffReport);

export default router;
