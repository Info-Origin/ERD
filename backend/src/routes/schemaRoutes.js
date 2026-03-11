import express from "express";
import {
  listSchemas,
  getSchemaErdController,
} from "../controllers/schemaController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { requireConnection } from "../middleware/connectionAuthMiddleware.js";

const router = express.Router();

// Try connection auth first, fallback to optional auth
const tryConnectionAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Try connection auth
    requireConnection(req, res, (err) => {
      if (err) {
        // If connection auth fails, try optional auth
        optionalAuth(req, res, next);
      } else {
        next();
      }
    });
  } else {
    // No auth header, use optional auth
    optionalAuth(req, res, next);
  }
};

// APPLICATION ROUTES 
//  Get list of applications for dropdown
 
/*
router.get("/applications", tryConnectionAuth, async (req, res) => {
  try {
    // const applications = await applicationService.getApplications();
    
    // TODO: Filter by user access when authentication is ready
    // const userApplications = filterByUserAccess(applications, req.user.id);
    
    // Temporary hardcoded response for testing
    const applications = [
      {
        aeApplicationUuid: "f487663908ebf11eabb6112c1e641f7d9",
        applicationName: "InfoQA (Dev)",
        status: "Active"
      },
      {
        aeApplicationUuid: "zb9952b18945111eabb611c1e641f7d9",
        applicationName: "Staffing Origin (Dev)",
        status: "Active"
      },
      {
        aeApplicationUuid: "bfb59e2-4927-11ed-be6d-0a68df95ca6d",
        applicationName: "App Builder",
        status: "Active"
      },
      {
        aeApplicationUuid: "20d01c24-a07b-11ed-8438-f7be46f306d0",
        applicationName: "Infoorigin Home",
        status: "Active"
      }
    ];
    
    // Filter only active applications
    const activeApplications = applications.filter(app => app.status === "Active");
    
    res.json({ applications: activeApplications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: error.message });
  }
});
*/

// ==================== SCHEMA ROUTES ====================

// Current route: Get all schemas
router.get("/schemas", tryConnectionAuth, listSchemas);

//Get schemas filtered by application

/*
router.get("/schemas", tryConnectionAuth, async (req, res) => {
  const { applicationUuid } = req.query;
  
  if (applicationUuid) {
    // const schemas = await schemaService.getSchemasByApplication(applicationUuid);
    // return res.json({ schemas });
  }
  
  // Fallback to all schemas
  return listSchemas(req, res);
});
*/

//Get ERD data for a schema within an application context

/*
router.get("/schemas/:schema/erd/:applicationUuid", tryConnectionAuth, async (req, res) => {
  try {
    const { schema, applicationUuid } = req.params;
    
    console.log('Loading schema:', schema);
    console.log('For application:', applicationUuid);
    
    // const hasAccess = await verifyApplicationAccess(req.user.id, applicationUuid);
    // if (!hasAccess) {
    //   return res.status(403).json({ error: "Access denied to this application" });
    // }
    
    // For now, call existing controller (no filtering)
    req.params.schema = schema;
    return getSchemaErdController(req, res);
  } catch (error) {
    console.error("Error fetching schema ERD:", error);
    res.status(500).json({ error: error.message });
  }
});
*/

// Current route: Get ERD for a schema
router.get("/schemas/:schema/erd", tryConnectionAuth, getSchemaErdController);

export default router;
