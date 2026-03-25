import { Router } from 'express';
import {
  getIncidentReport,
  downloadPDF,
  downloadExcel,
  getSLAReport,
} from '../controllers/reportController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/incidents', getIncidentReport);
router.get('/pdf', downloadPDF);
router.get('/excel', downloadExcel);
router.get('/sla', getSLAReport);

export default router;
