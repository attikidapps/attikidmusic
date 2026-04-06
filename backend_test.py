#!/usr/bin/env python3
"""
Backend API Testing for Independent Music Streaming Platform
Tests all API endpoints with proper authentication and validation
"""

import requests
import json
import os
import tempfile
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://music-box-13.preview.emergentagent.com"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "attikid"

class MusicPlatformTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.test_song_id = None
        self.test_comment_id = None
        self.session = requests.Session()
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
        
    def create_test_audio_file(self) -> str:
        """Create a small test audio file with .mp3 extension"""
        # Create a temporary file with .mp3 extension
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        # Write some dummy binary data (doesn't need to be real audio)
        temp_file.write(b'\x00\x01\x02\x03' * 1000)  # 4KB of dummy data
        temp_file.close()
        return temp_file.name
        
    def test_health_check(self) -> bool:
        """Test GET /api/health"""
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok' and 'timestamp' in data:
                    self.log_test("Health Check", True, f"Status: {data['status']}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
            
    def test_get_songs_empty(self) -> bool:
        """Test GET /api/songs (should be empty initially)"""
        try:
            response = self.session.get(f"{self.base_url}/api/songs")
            
            if response.status_code == 200:
                data = response.json()
                if 'songs' in data and isinstance(data['songs'], list):
                    self.log_test("Get Songs (Empty)", True, f"Found {len(data['songs'])} songs")
                    return True
                else:
                    self.log_test("Get Songs (Empty)", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Get Songs (Empty)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Songs (Empty)", False, f"Exception: {str(e)}")
            return False
            
    def test_admin_login(self) -> bool:
        """Test POST /api/admin/login"""
        try:
            payload = {
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(
                f"{self.base_url}/api/admin/login",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and data.get('message') == 'Login successful':
                    self.admin_token = data['token']
                    self.log_test("Admin Login", True, f"Token received: {self.admin_token[:20]}...")
                    return True
                else:
                    self.log_test("Admin Login", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
            
    def test_admin_login_invalid(self) -> bool:
        """Test POST /api/admin/login with invalid credentials"""
        try:
            payload = {
                "username": "admin",
                "password": "wrongpassword"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/admin/login",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_test("Admin Login (Invalid)", True, "Correctly rejected invalid credentials")
                    return True
                else:
                    self.log_test("Admin Login (Invalid)", False, f"Expected error message: {data}")
                    return False
            else:
                self.log_test("Admin Login (Invalid)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login (Invalid)", False, f"Exception: {str(e)}")
            return False
            
    def test_upload_song(self) -> bool:
        """Test POST /api/upload"""
        if not self.admin_token:
            self.log_test("Upload Song", False, "No admin token available")
            return False
            
        try:
            # Create test audio file
            test_file_path = self.create_test_audio_file()
            
            with open(test_file_path, 'rb') as f:
                files = {
                    'file': ('test_song.mp3', f, 'audio/mpeg'),
                    'title': (None, 'Test Song for API Testing')
                }
                
                headers = {
                    'Authorization': f'Bearer {self.admin_token}'
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/upload",
                    files=files,
                    headers=headers
                )
            
            # Clean up temp file
            os.unlink(test_file_path)
            
            if response.status_code == 201:
                data = response.json()
                if 'song' in data and 'id' in data['song']:
                    self.test_song_id = data['song']['id']
                    song = data['song']
                    self.log_test("Upload Song", True, f"Song uploaded: {song['title']} (ID: {song['id']})")
                    return True
                else:
                    self.log_test("Upload Song", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Upload Song", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Upload Song", False, f"Exception: {str(e)}")
            return False
            
    def test_upload_unauthorized(self) -> bool:
        """Test POST /api/upload without admin token"""
        try:
            test_file_path = self.create_test_audio_file()
            
            with open(test_file_path, 'rb') as f:
                files = {
                    'file': ('test_song.mp3', f, 'audio/mpeg'),
                    'title': (None, 'Unauthorized Upload Test')
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/upload",
                    files=files
                )
            
            os.unlink(test_file_path)
            
            if response.status_code == 401:
                self.log_test("Upload Song (Unauthorized)", True, "Correctly rejected unauthorized upload")
                return True
            else:
                self.log_test("Upload Song (Unauthorized)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Upload Song (Unauthorized)", False, f"Exception: {str(e)}")
            return False
            
    def test_get_songs_with_data(self) -> bool:
        """Test GET /api/songs (should have uploaded song)"""
        try:
            response = self.session.get(f"{self.base_url}/api/songs")
            
            if response.status_code == 200:
                data = response.json()
                if 'songs' in data and len(data['songs']) > 0:
                    songs = data['songs']
                    found_test_song = any(song.get('id') == self.test_song_id for song in songs)
                    if found_test_song:
                        self.log_test("Get Songs (With Data)", True, f"Found {len(songs)} songs including uploaded test song")
                        return True
                    else:
                        self.log_test("Get Songs (With Data)", False, f"Test song not found in {len(songs)} songs")
                        return False
                else:
                    self.log_test("Get Songs (With Data)", False, "No songs found after upload")
                    return False
            else:
                self.log_test("Get Songs (With Data)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Songs (With Data)", False, f"Exception: {str(e)}")
            return False
            
    def test_like_song(self) -> bool:
        """Test POST /api/likes"""
        if not self.test_song_id:
            self.log_test("Like Song", False, "No test song ID available")
            return False
            
        try:
            payload = {"songId": self.test_song_id}
            
            response = self.session.post(
                f"{self.base_url}/api/likes",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'likes' in data and isinstance(data['likes'], int):
                    self.log_test("Like Song", True, f"Song liked, new count: {data['likes']}")
                    return True
                else:
                    self.log_test("Like Song", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Like Song", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Like Song", False, f"Exception: {str(e)}")
            return False
            
    def test_track_play(self) -> bool:
        """Test POST /api/plays"""
        if not self.test_song_id:
            self.log_test("Track Play", False, "No test song ID available")
            return False
            
        try:
            payload = {"songId": self.test_song_id}
            
            response = self.session.post(
                f"{self.base_url}/api/plays",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'plays' in data and isinstance(data['plays'], int):
                    self.log_test("Track Play", True, f"Play tracked, new count: {data['plays']}")
                    return True
                else:
                    self.log_test("Track Play", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Track Play", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Track Play", False, f"Exception: {str(e)}")
            return False
            
    def test_add_comment(self) -> bool:
        """Test POST /api/comments"""
        if not self.test_song_id:
            self.log_test("Add Comment", False, "No test song ID available")
            return False
            
        try:
            payload = {
                "songId": self.test_song_id,
                "name": "Test User",
                "text": "Great song! Testing the comment system."
            }
            
            response = self.session.post(
                f"{self.base_url}/api/comments",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 201:
                data = response.json()
                if 'comment' in data and 'id' in data['comment']:
                    self.test_comment_id = data['comment']['id']
                    comment = data['comment']
                    self.log_test("Add Comment", True, f"Comment added: '{comment['text']}' by {comment['name']}")
                    return True
                else:
                    self.log_test("Add Comment", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Add Comment", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Add Comment", False, f"Exception: {str(e)}")
            return False
            
    def test_get_comments(self) -> bool:
        """Test GET /api/comments?songId=xxx"""
        if not self.test_song_id:
            self.log_test("Get Comments", False, "No test song ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/api/comments?songId={self.test_song_id}")
            
            if response.status_code == 200:
                data = response.json()
                if 'comments' in data and isinstance(data['comments'], list):
                    comments = data['comments']
                    found_test_comment = any(comment.get('id') == self.test_comment_id for comment in comments)
                    if found_test_comment:
                        self.log_test("Get Comments", True, f"Found {len(comments)} comments including test comment")
                        return True
                    else:
                        self.log_test("Get Comments", False, f"Test comment not found in {len(comments)} comments")
                        return False
                else:
                    self.log_test("Get Comments", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Get Comments", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Comments", False, f"Exception: {str(e)}")
            return False
            
    def test_update_song_title(self) -> bool:
        """Test PUT /api/songs"""
        if not self.admin_token or not self.test_song_id:
            self.log_test("Update Song Title", False, "Missing admin token or song ID")
            return False
            
        try:
            payload = {
                "id": self.test_song_id,
                "title": "Updated Test Song Title"
            }
            
            headers = {
                'Authorization': f'Bearer {self.admin_token}',
                'Content-Type': 'application/json'
            }
            
            response = self.session.put(
                f"{self.base_url}/api/songs",
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'song' in data and data['song']['title'] == payload['title']:
                    self.log_test("Update Song Title", True, f"Title updated to: {data['song']['title']}")
                    return True
                else:
                    self.log_test("Update Song Title", False, f"Title not updated correctly: {data}")
                    return False
            else:
                self.log_test("Update Song Title", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Song Title", False, f"Exception: {str(e)}")
            return False
            
    def test_update_song_unauthorized(self) -> bool:
        """Test PUT /api/songs without admin token"""
        if not self.test_song_id:
            self.log_test("Update Song (Unauthorized)", False, "No test song ID available")
            return False
            
        try:
            payload = {
                "id": self.test_song_id,
                "title": "Unauthorized Update"
            }
            
            response = self.session.put(
                f"{self.base_url}/api/songs",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                self.log_test("Update Song (Unauthorized)", True, "Correctly rejected unauthorized update")
                return True
            else:
                self.log_test("Update Song (Unauthorized)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Update Song (Unauthorized)", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_comment(self) -> bool:
        """Test DELETE /api/comments?id=xxx"""
        if not self.admin_token or not self.test_comment_id:
            self.log_test("Delete Comment", False, "Missing admin token or comment ID")
            return False
            
        try:
            headers = {
                'Authorization': f'Bearer {self.admin_token}'
            }
            
            response = self.session.delete(
                f"{self.base_url}/api/comments?id={self.test_comment_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Comment deleted successfully':
                    self.log_test("Delete Comment", True, "Comment deleted successfully")
                    return True
                else:
                    self.log_test("Delete Comment", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Delete Comment", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Comment", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_comment_unauthorized(self) -> bool:
        """Test DELETE /api/comments without admin token"""
        try:
            response = self.session.delete(f"{self.base_url}/api/comments?id=fake-id")
            
            if response.status_code == 401:
                self.log_test("Delete Comment (Unauthorized)", True, "Correctly rejected unauthorized delete")
                return True
            else:
                self.log_test("Delete Comment (Unauthorized)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Delete Comment (Unauthorized)", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_song(self) -> bool:
        """Test DELETE /api/songs?id=xxx"""
        if not self.admin_token or not self.test_song_id:
            self.log_test("Delete Song", False, "Missing admin token or song ID")
            return False
            
        try:
            headers = {
                'Authorization': f'Bearer {self.admin_token}'
            }
            
            response = self.session.delete(
                f"{self.base_url}/api/songs?id={self.test_song_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Song deleted successfully':
                    self.log_test("Delete Song", True, "Song and associated data deleted successfully")
                    return True
                else:
                    self.log_test("Delete Song", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Delete Song", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Song", False, f"Exception: {str(e)}")
            return False
            
    def test_delete_song_unauthorized(self) -> bool:
        """Test DELETE /api/songs without admin token"""
        try:
            response = self.session.delete(f"{self.base_url}/api/songs?id=fake-id")
            
            if response.status_code == 401:
                self.log_test("Delete Song (Unauthorized)", True, "Correctly rejected unauthorized delete")
                return True
            else:
                self.log_test("Delete Song (Unauthorized)", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Delete Song (Unauthorized)", False, f"Exception: {str(e)}")
            return False
            
    def test_validation_errors(self) -> bool:
        """Test various validation scenarios"""
        validation_tests = []
        
        # Test missing songId for likes
        try:
            response = self.session.post(f"{self.base_url}/api/likes", json={})
            validation_tests.append(response.status_code == 400)
        except:
            validation_tests.append(False)
            
        # Test missing songId for plays
        try:
            response = self.session.post(f"{self.base_url}/api/plays", json={})
            validation_tests.append(response.status_code == 400)
        except:
            validation_tests.append(False)
            
        # Test missing text for comments
        try:
            response = self.session.post(f"{self.base_url}/api/comments", json={"songId": "test"})
            validation_tests.append(response.status_code == 400)
        except:
            validation_tests.append(False)
            
        # Test missing songId for get comments
        try:
            response = self.session.get(f"{self.base_url}/api/comments")
            validation_tests.append(response.status_code == 400)
        except:
            validation_tests.append(False)
            
        success = all(validation_tests)
        self.log_test("Validation Errors", success, f"Passed {sum(validation_tests)}/{len(validation_tests)} validation tests")
        return success
        
    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("BACKEND API TESTING - Independent Music Streaming Platform")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Admin Credentials: {ADMIN_USERNAME}/{ADMIN_PASSWORD}")
        print()
        
        test_results = []
        
        # Basic functionality tests
        test_results.append(self.test_health_check())
        test_results.append(self.test_get_songs_empty())
        
        # Authentication tests
        test_results.append(self.test_admin_login())
        test_results.append(self.test_admin_login_invalid())
        
        # Upload tests
        test_results.append(self.test_upload_song())
        test_results.append(self.test_upload_unauthorized())
        
        # Song interaction tests
        test_results.append(self.test_get_songs_with_data())
        test_results.append(self.test_like_song())
        test_results.append(self.test_track_play())
        
        # Comment tests
        test_results.append(self.test_add_comment())
        test_results.append(self.test_get_comments())
        
        # Admin update tests
        test_results.append(self.test_update_song_title())
        test_results.append(self.test_update_song_unauthorized())
        
        # Admin delete tests
        test_results.append(self.test_delete_comment())
        test_results.append(self.test_delete_comment_unauthorized())
        test_results.append(self.test_delete_song())
        test_results.append(self.test_delete_song_unauthorized())
        
        # Validation tests
        test_results.append(self.test_validation_errors())
        
        # Summary
        passed = sum(test_results)
        total = len(test_results)
        
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
        else:
            print(f"\n⚠️  {total - passed} tests failed. Please check the details above.")
            
        return passed == total

if __name__ == "__main__":
    tester = MusicPlatformTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)