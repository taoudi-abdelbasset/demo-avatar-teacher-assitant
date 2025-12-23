import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

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
  private apiUrl = 'http://localhost:5000/api'; // Your backend URL
  
  // Cache for responses (cleared on page refresh)
  private responseCache = new Map<string, BackendResponse>();

  constructor(private http: HttpClient) {}

  /**
   * Send message to backend (text and/or images)
   * Returns text response, audio file, and CSV blendshapes
   */
  async sendMessage(text: string, images?: string[]): Promise<BackendResponse> {
    // Create cache key
    const cacheKey = `${text}_${images?.length || 0}`;
    
    // Check cache first
    if (this.responseCache.has(cacheKey)) {
      console.log('📦 Returning cached response');
      return this.responseCache.get(cacheKey)!;
    }

    // TODO: Replace with actual API call
    // const formData = new FormData();
    // formData.append('text', text);
    // if (images) {
    //   images.forEach((img, i) => formData.append(`image_${i}`, img));
    // }
    // const response = await this.http.post<any>(this.apiUrl, formData).toPromise();

    // MOCK RESPONSE FOR TESTING
    const mockResponse = await this.getMockResponse(text);
    
    // Cache the response
    this.responseCache.set(cacheKey, mockResponse);
    
    return mockResponse;
  }

  /**
   * Mock response for testing (remove this when backend is ready)
   */
  private async getMockResponse(text: string): Promise<BackendResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      // Load the actual CSV file from assets
      const csvResponse = await fetch('/assets/animation_frames.csv');
      const csvData = await csvResponse.text();

      // Use the actual audio file
      const audioUrl = '/assets/out.wav';

      return {
        text: `This is a test response with real audio and lip-sync data. Your message was: "${text}"`,
        audioUrl: audioUrl,
        csvData: csvData
      };
    } catch (error) {
      console.error('Error loading test files:', error);
      
      // Fallback to generated mock data if files not found
      const mockCsvData = this.generateMockCSV();
      const mockAudioUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

      return {
        text: `Mock response (could not load test files): "${text}"`,
        audioUrl: mockAudioUrl,
        csvData: mockCsvData
      };
    }
  }

  /**
   * Generate mock CSV with blendshape data
   */
  private generateMockCSV(): string {
    const headers = ',timeCode,blendShapes.EyeBlinkLeft,blendShapes.EyeBlinkRight,blendShapes.JawOpen,blendShapes.MouthSmileLeft,blendShapes.MouthSmileRight,blendShapes.MouthFrownLeft,blendShapes.MouthFrownRight,blendShapes.BrowDownLeft,blendShapes.BrowDownRight,blendShapes.BrowInnerUp,blendShapes.BrowOuterUpLeft,blendShapes.BrowOuterUpRight';
    
    let csv = headers + '\n';
    
    // Generate 3 seconds of data at 30fps
    const fps = 30;
    const duration = 3;
    
    for (let frame = 0; frame < fps * duration; frame++) {
      const time = frame / fps;
      
      // Simulate talking with random blendshapes
      const eyeBlink = Math.random() > 0.9 ? 0.8 : 0.0;
      const jawOpen = 0.3 + Math.sin(time * 10) * 0.2;
      const smile = Math.random() * 0.3;
      const browUp = Math.random() * 0.2;
      
      csv += `${frame},${time.toFixed(6)},${eyeBlink},${eyeBlink},${jawOpen},${smile},${smile},0.0,0.0,0.0,0.0,${browUp},${browUp},${browUp}\n`;
    }
    
    return csv;
  }

  /**
   * Parse CSV data into usable format
   */
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

  /**
   * Clear response cache
   */
  clearCache() {
    this.responseCache.clear();
  }
}