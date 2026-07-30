const pool = require('../../db');

const getVolunteerCatalogs = async (req,res)=>{

    try{

        const interests=await pool.query(`
            SELECT
                id_interest,
                interest_name
            FROM volunteers.volunteer_interests
            WHERE active=true
            ORDER BY interest_name
        `);

        const skills=await pool.query(`
            SELECT
                id_skill,
                skill_name
            FROM volunteers.volunteer_skills
            WHERE active=true
            ORDER BY skill_name
        `);

        const certifications=await pool.query(`
            SELECT
                id_certification,
                certification_name
            FROM volunteers.volunteer_certifications
            WHERE active=true
            ORDER BY certification_name
        `);

        const availability=await pool.query(`
            SELECT
                id_availability,
                availability_name
            FROM volunteers.availability_types
            ORDER BY id_availability
        `);

        res.json({

            interests:interests.rows,

            skills:skills.rows,

            certifications:certifications.rows,

            availability:availability.rows

        });

    }catch(err){

        console.error(err);

        res.status(500).json({

            error:'Unable to load volunteer catalogs.'

        });

    }

};

const getAvailabilityTypes = async (req, res) => {

    try{

        const result = await pool.query(`

            SELECT

                id_availability,
                availability_name

            FROM volunteers.availability_types

            ORDER BY id_availability;

        `);

        res.json(result.rows);

    }catch(err){

        console.error(err);

        res.status(500).json({

            error:'Unable to load availability types.'

        });

    }

};

module.exports={

    getVolunteerCatalogs, getAvailabilityTypes

};