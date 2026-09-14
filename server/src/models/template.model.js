class TemplateModel {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.content = data.content;
    this.variables = data.variables ? data.variables.split(',').map(v => v.trim()) : [];
    this.is_active = data.is_active;
    this.created_at = new Date(data.created_at);
    this.updated_at = new Date(data.updated_at);
  }

  // Validation methods
  static validate(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Template name is required');
    }
    
    if (!data.content || data.content.trim().length === 0) {
      errors.push('Template content is required');
    }
    
    return errors;
  }

  // Format for API response
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      content: this.content,
      variables: this.variables,
      is_active: this.is_active,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Render template with variables
  render(variables = {}) {
    let content = this.content;
    
    this.variables.forEach(variable => {
      const value = variables[variable] || `{${variable}}`;
      const regex = new RegExp(`\\{${variable}\\}`, 'g');
      content = content.replace(regex, value);
    });
    
    return content;
  }

  // Preview with sample data
  preview() {
    const sampleData = {
      name: 'John Doe',
      uid: '827305001',
      date: 'Jumat, 13 September 2026',
      time: '08:15:30',
      mode: 'Masuk',
      ip: '192.168.1.102',
      datetime: 'Jumat, 13 September 2026, 08:15',
      transaction_id: '827305001-20260913081530'
    };
    
    return this.render(sampleData);
  }

  // Extract variables from template content
  static extractVariables(content) {
    const variableRegex = /\{([^}]+)\}/g;
    const variables = new Set();
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  // Validate variables in content
  validateVariables() {
    const extracted = TemplateModel.extractVariables(this.content);
    const declared = this.variables;
    
    const undeclared = extracted.filter(v => !declared.includes(v));
    const unused = declared.filter(v => !extracted.includes(v));
    
    return {
      valid: undeclared.length === 0 && unused.length === 0,
      warnings: {
        undeclared,
        unused
      }
    };
  }
}

module.exports = TemplateModel;
