const database = require('../services/database.service');
const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

class TemplatesController {
  async getTemplates(req, res, next) {
    try {
      const templates = database.getTemplates();
      
      res.json({
        success: true,
        count: templates.length,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplate(req, res, next) {
    try {
      const { id } = req.params;
      
      // Get by ID (need to query differently)
      const allTemplates = database.getTemplates();
      const template = allTemplates.find(t => t.id == id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: `Template with ID ${id} not found`
        });
      }
      
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateByName(req, res, next) {
    try {
      const { name } = req.params;
      
      const template = database.getTemplate(name);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: `Template "${name}" not found`
        });
      }
      
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req, res, next) {
    try {
      const { name, content, variables } = req.body;
      
      if (!name || !content) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, content'
        });
      }
      
      const result = database.createTemplate({
        name,
        content,
        variables: variables || ''
      });
      
      logger.info('Template created', { id: result.id, name });
      
      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          name
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { name, content, variables, is_active } = req.body;
      
      const result = database.updateTemplate(id, {
        name,
        content,
        variables,
        is_active
      });
      
      logger.info('Template updated', { id, changes: result.changes });
      
      res.json({
        success: true,
        data: {
          id,
          changes: result.changes
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = database.deleteTemplate(id);
      
      logger.info('Template deleted (soft)', { id });
      
      res.json({
        success: true,
        data: {
          id,
          deleted: true
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async previewTemplate(req, res, next) {
    try {
      const { templateName, variables } = req.body;
      
      if (!templateName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: templateName'
        });
      }
      
      const template = database.getTemplate(templateName);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: `Template "${templateName}" not found`
        });
      }
      
      // Render with provided variables or use sample data
      const sampleVars = variables || {
        name: 'John Doe',
        uid: '827305001',
        date: 'Jumat, 13 September 2026',
        time: '08:15:30',
        mode: 'Masuk',
        ip: '192.168.1.102',
        datetime: 'Jumat, 13 September 2026, 08:15',
        transaction_id: '827305001-20260913081530'
      };
      
      const rendered = helpers.renderTemplate(template.content, sampleVars);
      
      res.json({
        success: true,
        data: {
          template: template.content,
          variables: sampleVars,
          rendered
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TemplatesController();
