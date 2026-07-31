const pool = require('../../db');

const catalogs = {

    skills:{
        table:'volunteers.volunteer_skills',
        id:'id_skill',
        name:'skill_name'
    },

    interests:{
        table:'volunteers.volunteer_interests',
        id:'id_interest',
        name:'interest_name'
    },

    certifications:{
        table:'volunteers.volunteer_certifications',
        id:'id_certification',
        name:'certification_name'
    },

    availability:{
        table:'volunteers.availability_types',
        id:'id_availability',
        name:'availability_name'
    },

    functions:{
        table:'volunteers.volunteer_functions',
        id:'id_function',
        name:'function_name'
    }

};

function getConfig(catalog){

    return catalogs[catalog];

}

const getCatalog = async(req,res)=>{

    try{

        const config=getConfig(req.params.catalog);

        if(!config){

            return res.status(404).json({

                error:'Catalog not found'

            });

        }

        const sql=`

            SELECT

                ${config.id} AS id,

                ${config.name} AS name,

                description,

                active,

                created_at,

                updated_at

            FROM ${config.table}

            ORDER BY ${config.name};

        `;

        const result=await pool.query(sql);

        res.json(result.rows);

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            error:'Unable to load catalog.'

        });

    }

};
const createCatalogItem=async(req,res)=>{


      try {

          const config = getConfig(req.params.catalog);

          if (!config) {

              return res.status(404).json({
                  error: 'Catalog not found'
              });

          }

          const { name, description, active } = req.body;

          const sql = `

              INSERT INTO ${config.table}

              (

                  ${config.name},

                  description,

                  active

              )

              VALUES

              ($1,$2,$3)

              RETURNING *;

          `;

          const result = await pool.query(

              sql,

              [

                  name,

                  description || '',

                  active ?? true

              ]

          );

          res.status(201).json(result.rows[0]);

      }
      catch (err) {

          console.error(err);

          res.status(500).json({

              error: 'Unable to create catalog item.'

          });

      }



};

const updateCatalogItem=async(req,res)=>{


    try {

        const config = getConfig(req.params.catalog);

        if (!config) {

            return res.status(404).json({
                error:'Catalog not found'
            });

        }

        const { name, description, active } = req.body;

        const sql = `

            UPDATE ${config.table}

            SET

                ${config.name}=$1,

                description=$2,

                active=$3,

                updated_at=NOW()

            WHERE ${config.id}=$4

            RETURNING *;

        `;

        const result = await pool.query(

            sql,

            [

                name,

                description,

                active,

                req.params.id

            ]

        );

        res.json(result.rows[0]);

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            error:'Unable to update catalog.'

        });

    }


};

const deleteCatalogItem=async(req,res)=>{


    try {

        const config = getConfig(req.params.catalog);

        if (!config) {

            return res.status(404).json({
                error:'Catalog not found'
            });

        }

        await pool.query(

            `DELETE FROM ${config.table}

             WHERE ${config.id}=$1`,

            [req.params.id]

        );

        res.json({

            success:true

        });

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            error:'Unable to delete catalog.'

        });

    }



};

module.exports={

    getCatalog,

    createCatalogItem,

    updateCatalogItem,

    deleteCatalogItem

};