const express=require('express');

const router=express.Router();

const volunteerController=require('../../controllers/volunteers/volunteerController');

router.get('/catalogs', volunteerController.getVolunteerCatalogs);
router.get('/availability-types', volunteerController.getAvailabilityTypes);

module.exports=router;