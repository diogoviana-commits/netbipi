import { Router } from 'express';
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addComment,
  createFromAlert,
  getTicketStats,
} from '../controllers/ticketController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTickets);
router.get('/stats', getTicketStats);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.post('/from-alert/:alertId', createFromAlert);
router.put('/:id', updateTicket);
router.post('/:id/comments', addComment);

export default router;
