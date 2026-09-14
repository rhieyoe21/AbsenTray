const database = require('../services/database.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

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
      // Upload file CSV/XLSX (multer) — auto-detect dari nama file.
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: 'File CSV/Excel wajib diunggah' });
      }
      
      const buffer = req.file.buffer;
      if (buffer.length === 0) {
        return res.status(400).json({ success: false, error: 'File kosong' });
      }
      
      const filename = req.file.originalname || '';
      const isExcel = /\.(xlsx|xls)$/i.test(filename);
      
      // Baca baris: dari XLSX atau CSV.
      let rows = [];
      if (isExcel) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        rows = await new Promise((resolve, reject) => {
          const acc = [];
          Readable.from(buffer)
            .pipe(csv())
            .on('data', (r) => acc.push(r))
            .on('end', () => resolve(acc))
            .on('error', reject);
        });
      }
      
      const imported = [];
      const skipped = [];
      const errors = [];
      const seenUid = new Set(); // pastikan UID unik dalam satu file
      
      rows.forEach((row) => {
        try {
          const uid = String(row.uid !== undefined ? row.uid : row.UID || '').trim();
          const name = String(row.name !== undefined ? row.name : row.Nama || '').trim();
          const wa = String(row.wa !== undefined ? row.wa : (row.whatsapp_number || row.WhatsApp || '')).trim().replace(/\D/g, '');
          
          if (!uid || !name || !wa) {
            skipped.push({ uid, reason: 'kolom uid/name/wa tidak lengkap' });
            return;
          }
          
          if (seenUid.has(uid)) {
            skipped.push({ uid, reason: `UID ${uid} duplikat dalam file` });
            return;
          }
          seenUid.add(uid);
          
          const existing = database.getUser(uid);
          if (existing) {
            skipped.push({ uid, reason: `UID ${uid} sudah ada` });
            return;
          }
          
          database.createUser({ uid, name, whatsapp_number: wa });
          imported.push({ uid, name });
        } catch (error) {
          errors.push({ row, error: error.message });
        }
      });
      
      logger.info(`Import selesai (${isExcel ? 'xlsx' : 'csv'})`, {
        filename,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length
      });
      
      res.json({
        success: true,
        data: {
          imported: imported.length,
          skipped: skipped.length,
          errors: errors.length,
          importedUsers: imported.slice(0, 50),
          skippedReasons: skipped.slice(0, 50),
          errorRows: errors.slice(0, 10)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async exportUsersCSV(req, res, next) {
    try {
      const result = database.getUsers(10000, 0);
      
      const lines = ['uid,name,whatsapp_number'];
      result.data.forEach((u) => {
        lines.push(`${u.uid},${u.name},${u.whatsapp_number}`);
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      res.send(lines.join('\n'));
    } catch (error) {
      next(error);
    }
  }

  async exportUsersExcel(req, res, next) {
    try {
      const result = database.getUsers(10000, 0);
      
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Guru');
      
      ws.columns = [
        { header: 'uid', key: 'uid', width: 15 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'whatsapp_number', key: 'whatsapp_number', width: 22 }
      ];
      
      result.data.forEach((u) => {
        ws.addRow({ uid: u.uid, name: u.name, whatsapp_number: u.whatsapp_number });
      });
      
      // Otomatis lebar kolom berdasarkan konten
      ws.columns.forEach((col) => {
        const maxLen = col.values ? col.values.reduce((mx, v) => Math.max(mx, String(v || '').length), 0) : 10;
        col.width = Math.min(Math.max(maxLen + 2, 10), 40);
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.xlsx');
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();
