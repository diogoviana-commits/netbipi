import { Router } from 'express';
import { getIncidentTimeline } from '../controllers/timelineController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/', getIncidentTimeline);

export default router;
