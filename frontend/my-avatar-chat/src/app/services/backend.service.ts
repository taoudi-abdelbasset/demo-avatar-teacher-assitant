import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface BackendResponse {
  text: string;
  audioUrl?: string;
  csvData?: string;
  audioBlob?: Blob;
}

@Injectable({
  providedIn: 'root'
})
export class BackendService {
  private apiUrl = 'http://localhost:5000/api';
  private responseCache = new Map<string, BackendResponse>();

  constructor(private http: HttpClient) {}

  /**
   * Send message - ALWAYS takes exactly 4 seconds for thinking
   */
  async sendMessage(text: string, images?: string[]): Promise<BackendResponse> {
    const cacheKey = `${text}_${images?.length || 0}`;
    
    if (this.responseCache.has(cacheKey)) {
      console.log('📦 Returning cached response');
      // Even cached responses take 4 seconds for thinking animation
      await this.delay(10000);
      return this.responseCache.get(cacheKey)!;
    }

    // ALWAYS wait 4 seconds for thinking phase
    const [response] = await Promise.all([
      this.getMockResponse(text),
      this.delay(10000) // 🎯 Thinking time - ALWAYS 4 seconds
    ]);
    
    this.responseCache.set(cacheKey, response);
    return response;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getMockResponse(text: string): Promise<BackendResponse> {
    try {
      const csvResponse = await fetch('/assets/animation_frames.csv');
      const csvData = await csvResponse.text();
      const audioUrl = '/assets/out.wav';

      return {
        text: `This is a test response with real audio and lip-sync data. Your message was: "${text}"`,
        audioUrl: audioUrl,
        csvData: csvData
      };
    } catch (error) {
      console.error('Error loading test files:', error);
      
      const mockCsvData = this.generateMockCSV();
      const mockAudioUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

      return {
        text: `Mock response: "${text}"`,
        audioUrl: mockAudioUrl,
        csvData: mockCsvData
      };
    }
  }

  private generateMockCSV(): string {
    const headers = ',timeCode,blendShapes.EyeBlinkLeft,blendShapes.EyeBlinkRight,blendShapes.JawOpen,blendShapes.MouthSmileLeft,blendShapes.MouthSmileRight,blendShapes.MouthFrownLeft,blendShapes.MouthFrownRight,blendShapes.BrowDownLeft,blendShapes.BrowDownRight,blendShapes.BrowInnerUp,blendShapes.BrowOuterUpLeft,blendShapes.BrowOuterUpRight';
    
    let csv = headers + '\n';
    const fps = 30;
    const duration = 3;
    
    for (let frame = 0; frame < fps * duration; frame++) {
      const time = frame / fps;
      const eyeBlink = Math.random() > 0.9 ? 0.8 : 0.0;
      const jawOpen = 0.3 + Math.sin(time * 10) * 0.2;
      const smile = Math.random() * 0.3;
      const browUp = Math.random() * 0.2;
      
      csv += `${frame},${time.toFixed(6)},${eyeBlink},${eyeBlink},${jawOpen},${smile},${smile},0.0,0.0,0.0,0.0,${browUp},${browUp},${browUp}\n`;
    }
    
    return csv;
  }

  parseCSV(csvData: string): any[] {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      
      headers.forEach((header, index) => {
        if (header.trim()) {
          row[header.trim()] = parseFloat(values[index]) || 0;
        }
      });
      
      data.push(row);
    }

    return data;
  }

  clearCache() {
    this.responseCache.clear();
  }
}