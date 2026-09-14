const database = require('../services/database.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class UsersController {
  async getUsers(req, res, next) {
    try {
      const { limit = 25, offset = 0, search } = req.query;
      
      let result = database.getUsers(parseInt(limit), parseInt(offset));
      
      // Simple search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        result.data = result.data.filter(user => 
          user.name.toLowerCase().includes(searchLower) ||
          user.uid.toLowerCase().includes(searchLower) ||
          user.whatsapp_number.includes(searchLower)
        );
        result.total = result.data.length;
      }
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.total > (parseInt(offset) + parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUser(req, res, next) {
    try {
      const { uid } = req.params;
      
      const user = database.getUser(uid);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: `User with UID ${uid} not found`
        });
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req, res, next) {
    try {
      const { uid, name, whatsapp_number, is_active = 1 } = req.body;
      
      if (!uid || !name || !whatsapp_number) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: uid, name, whatsapp_number'
        });
      }
      
      const result = database.createUser({ uid, name, whatsapp_number, is_active });
      
      logger.info('User created', { uid, name });
      
      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          uid,
          name,
          whatsapp_number,
          is_active
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { uid } = req.params;
      const { name, whatsapp_number, is_active } = req.body;
      
      const result = database.updateUser(uid, { name, whatsapp_number, is_active });
      
      logger.info('User updated', { uid, changes: result.changes });
      
      res.json({
        success: true,
        data: {
          uid,
          changes: result.changes
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { uid } = req.params;
      
      const result = database.deleteUser(uid);
      
      logger.info('User deleted (soft)', { uid });
      
      res.json({
        success: true,
        data: {
          uid,
          deleted: true
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async importUsers(req, res, next) {
    try {
      // In production, use multer for file upload
      // For now, expect file path in body
      const { filePath } = req.body;
      
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or missing file path'
        });
      }
      
      const users = [];
      let imported = 0;
      let skipped = 0;
      let errors = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            if (row.uid && row.name && row.wa) {
              database.createUser({
                uid: row.uid.trim(),
                name: row.name.trim(),
                whatsapp_number: row.wa.trim()
              });
              imported++;
            } else {
              skipped++;
            }
          } catch (error) {
            errors.push({ row, error: error.message });
            skipped++;
          }
        })
        .on('end', () => {
          logger.info('CSV import completed', { imported, skipped, errors: errors.length });
          
          res.json({
            success: true,
            data: {
              imported,
              skipped,
              errors: errors.slice(0, 10) // Limit error list
            }
          });
        })
        .on('error', (error) => {
          next(error);
        });
    } catch (error) {
      next(error);
    }
  }

  async exportUsers(req, res, next) {
    try {
      const result = database.getUsers(10000, 0); // Get all users
      
      // Generate CSV
      const csvLines = ['uid,name,whatsapp_number'];
      
      result.data.forEach(user => {
        csvLines.push(`${user.uid},${user.name},${user.whatsapp_number}`);
      });
      
      const csv = csvLines.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      res.send(csv);
      
      logger.info('Users exported', { count: result.data.length });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();
