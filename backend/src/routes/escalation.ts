import { Router } from 'express';
import {
  getEscalations,
  getEscalationRules,
  getRules,
  updateRules,
} from '../controllers/escalationController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/', getEscalations);
router.get('/rules', getRules);
router.get('/all-rules', getEscalationRules);
router.put('/rules', updateRules);

export default router;
