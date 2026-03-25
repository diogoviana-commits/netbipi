import { Router } from 'express';
import {
  runPing,
  runDnsLookup,
  runPortCheck,
  runTraceroute,
  getDiagnosticHistory,
} from '../controllers/networkController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/ping', runPing);
router.post('/dns', runDnsLookup);
router.post('/port', runPortCheck);
router.post('/traceroute', runTraceroute);
router.get('/history', getDiagnosticHistory);

export default router;
